/**
 * games/hooks.ts: the async work a game needs from the worker. Game modules are pure
 * (packages/protocol/src/games), so anything that waits (the LLM, storage shared between
 * rooms) happens here and comes back to the module as a "server" action.
 *
 * GameRoom calls `prepare` before a game starts and passes the result to init() as `seed`.
 * After every state change it calls `effect`; if that returns a promise, the room waits for
 * it in the background and reduces the resolved action with from = "server" (null = nothing
 * to do). Results that arrive after the room moved to another game are dropped.
 */
import type { GameId } from "@questline/protocol/games";
import type { Env } from "../env";

/** Small JSON values kept across rooms (one Durable Object holds them all). */
export interface SharedStore {
  get<T>(key: string): Promise<T | null>;
  put(key: string, value: unknown): Promise<void>;
}

export interface GameHooks {
  prepare?(env: Env, shared: SharedStore): Promise<unknown>;
  effect?(env: Env, shared: SharedStore, prev: unknown, next: unknown): Promise<unknown> | null;
}

export const HOOKS: Partial<Record<GameId, GameHooks>> = {};
