/**
 * rooms/GameRoom.ts: one Durable Object per game room code. Holds the two seats and the
 * state of the game being played, and runs the game modules from @questline/protocol/games.
 *
 * Responsible for:
 * - `open()`, `exists()`: a room is created by seat a (the glasses) and joined by seat b.
 * - `view(seat)`: the poll. Marks the seat as present, starts the first game once both
 *   seats have shown up, runs the module's tick() so timed phases move on, and returns that
 *   seat's RoomView.
 * - `act(seat, action)`: "room.next" and "room.again" on a finished game, otherwise the
 *   module's reduce().
 * - Hooks (games/hooks.ts): prepare before a game starts, effect after each change.
 * - `sharedGet` / `sharedPut`: the instance named SHARED_ROOM keeps values that outlive a
 *   room, such as the trivia questions pairs leave for the next pair.
 *
 * Methods return JSON strings so the RPC types stay simple. No sockets and no alarms:
 * timers are deadlines in the game state, checked on each poll. Presence is kept in memory
 * only, so after an eviction both seats count as away until their next poll.
 *
 * Nothing here is authenticated. A seat is whatever the client says it is; the code is the
 * only key. Fine for a demo between two people at a table, not for anything private.
 */
import { DurableObject } from "cloudflare:workers";
import { GAMES, type GameCtx, type RoomView, type Seat } from "@questline/protocol/games";
import type { Env } from "../env";
import { HOOKS, type SharedStore } from "../games/hooks";

export const SHARED_ROOM = "shared";
/** A seat that has not polled for this long is shown as away. */
const PRESENT_MS = 5000;
/** A code can be taken over once its room has been quiet this long. */
export const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;

const ROOM_KEY = "room";

interface Room {
  code: string;
  /** Index into GAMES. */
  index: number;
  /** The module's state, or null before both seats have joined. */
  game: unknown;
  /** Bumped whenever a game is started, so late async results for an old game are dropped. */
  run: number;
  touchedAt: number;
}

export class GameRoom extends DurableObject<Env> {
  private room: Room | null = null;
  private seen: Record<Seat, number> = { a: 0, b: 0 };
  private starting: Promise<void> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<Room>(ROOM_KEY)) ?? null;
    });
  }

  private gameCtx(): GameCtx {
    return { now: Date.now(), rand: Math.random };
  }

  private shared(): SharedStore {
    const stub = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(SHARED_ROOM));
    return {
      async get<T>(key: string) {
        const raw = await stub.sharedGet(key);
        return raw === null ? null : (JSON.parse(raw) as T);
      },
      async put(key, value) {
        await stub.sharedPut(key, JSON.stringify(value));
      },
    };
  }

  private async save(): Promise<void> {
    if (!this.room) return;
    this.room.touchedAt = Date.now();
    await this.ctx.storage.put(ROOM_KEY, this.room);
  }

  /** Open this room. False when the code is in use by a room that is still active. */
  async open(code: string, reuse: boolean): Promise<boolean> {
    const live = this.room && Date.now() - this.room.touchedAt < ROOM_IDLE_MS;
    if (live) return reuse;
    this.room = { code, index: 0, game: null, run: 0, touchedAt: Date.now() };
    this.seen = { a: 0, b: 0 };
    await this.save();
    return true;
  }

  async exists(): Promise<boolean> {
    return this.room !== null;
  }

  private async start(index: number): Promise<void> {
    const room = this.room;
    if (!room) return;
    const mod = GAMES[index % GAMES.length]!;
    let seed: unknown;
    try {
      seed = await HOOKS[mod.id]?.prepare?.(this.env, this.shared());
    } catch (err) {
      console.error("game prepare failed", mod.id, err);
    }
    room.index = index % GAMES.length;
    room.run += 1;
    room.game = mod.init(this.gameCtx(), seed);
    await this.save();
  }

  /** Start a game once, even when both seats ask at the same moment. */
  private startOnce(index: number): Promise<void> {
    this.starting ??= this.start(index).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  /** Store a new game state and kick off any async work the game asks for. */
  private async commit(prev: unknown, next: unknown): Promise<void> {
    const room = this.room;
    if (!room || next === prev) return;
    room.game = next;
    await this.save();
    const mod = GAMES[room.index]!;
    const job = HOOKS[mod.id]?.effect?.(this.env, this.shared(), prev, next);
    if (!job) return;
    const run = room.run;
    this.ctx.waitUntil(
      job
        .then(async (action) => {
          if (action == null || !this.room || this.room.run !== run) return;
          const before = this.room.game;
          await this.commit(before, mod.reduce(before, "server", action, this.gameCtx()));
        })
        .catch((err) => console.error("game effect failed", mod.id, err)),
    );
  }

  private render(seat: Seat): string {
    const room = this.room!;
    const mod = GAMES[room.index]!;
    const now = Date.now();
    const other: Seat = seat === "a" ? "b" : "a";
    const view: RoomView = {
      code: room.code,
      seat,
      partnerHere: now - this.seen[other] < PRESENT_MS,
      gameId: room.game === null ? null : mod.id,
      game: room.game === null ? null : mod.view(room.game, seat),
      done: room.game !== null && mod.isDone(room.game),
      run: room.run,
      now,
    };
    return JSON.stringify(view);
  }

  async view(seat: Seat): Promise<string | null> {
    if (!this.room) return null;
    this.seen[seat] = Date.now();
    if (this.room.game === null) {
      if (this.seen.a && this.seen.b) await this.startOnce(0);
    } else {
      const mod = GAMES[this.room.index]!;
      await this.commit(this.room.game, mod.tick(this.room.game, this.gameCtx()));
    }
    return this.render(seat);
  }

  async act(seat: Seat, action: unknown): Promise<string | null> {
    const room = this.room;
    if (!room) return null;
    this.seen[seat] = Date.now();
    if (room.game !== null) {
      const mod = GAMES[room.index]!;
      const type = (action as { type?: unknown } | null)?.type;
      if (type === "room.next" || type === "room.again") {
        if (mod.isDone(room.game)) await this.startOnce(type === "room.next" ? room.index + 1 : room.index);
      } else {
        const ticked = mod.tick(room.game, this.gameCtx());
        await this.commit(room.game, mod.reduce(ticked, seat, action, this.gameCtx()));
      }
    }
    return this.render(seat);
  }

  async sharedGet(key: string): Promise<string | null> {
    return (await this.ctx.storage.get<string>(`shared:${key}`)) ?? null;
  }

  async sharedPut(key: string, json: string): Promise<void> {
    await this.ctx.storage.put(`shared:${key}`, json);
  }
}
