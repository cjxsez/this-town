/**
 * routes/game.ts: REST for the two-player game rooms (glasses at /g/, phone at /m).
 * The client side is roomApi in @questline/protocol/games (client.ts lists the calls).
 *
 * A room is a GameRoom Durable Object named by its 4-digit code. No auth: the code is the
 * only key, and a client names its own seat.
 */
import { Hono } from "hono";
import { ROOM_CODE, type Seat } from "@questline/protocol/games";
import type { AppEnv, Env } from "../env";

export const gameRoutes = new Hono<AppEnv>();

function room(env: Env, code: string) {
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(`room:${code}`));
}

function seatOf(raw: unknown): Seat | null {
  return raw === "a" || raw === "b" ? raw : null;
}

function json(body: string | null): Response {
  if (body === null) return Response.json({ error: "no such room" }, { status: 404 });
  return new Response(body, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

gameRoutes.post("/game/rooms", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { code?: unknown };
  if (typeof body.code === "string") {
    if (!ROOM_CODE.test(body.code)) return c.json({ error: "bad code" }, 400);
    await room(c.env, body.code).open(body.code, true);
    return c.json({ code: body.code });
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    if (await room(c.env, code).open(code, false)) return c.json({ code });
  }
  return c.json({ error: "no free room code" }, 503);
});

gameRoutes.post("/game/rooms/:code/join", async (c) => {
  const code = c.req.param("code");
  if (!ROOM_CODE.test(code) || !(await room(c.env, code).exists())) return c.json({ error: "no such room" }, 404);
  return c.json({ ok: true });
});

gameRoutes.get("/game/rooms/:code", async (c) => {
  const code = c.req.param("code");
  const seat = seatOf(c.req.query("seat"));
  if (!ROOM_CODE.test(code) || !seat) return c.json({ error: "bad code or seat" }, 400);
  return json(await room(c.env, code).view(seat));
});

gameRoutes.post("/game/rooms/:code/act", async (c) => {
  const code = c.req.param("code");
  const body = (await c.req.json().catch(() => null)) as { seat?: unknown; action?: unknown } | null;
  const seat = seatOf(body?.seat);
  if (!ROOM_CODE.test(code) || !seat) return c.json({ error: "bad code or seat" }, 400);
  return json(await room(c.env, code).act(seat, body?.action));
});
