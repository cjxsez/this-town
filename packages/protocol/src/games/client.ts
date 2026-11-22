/**
 * games/client.ts: the REST calls for a game room (worker routes/game.ts). No sockets:
 * clients poll `get` a little under once a second, which also tells the room they are
 * still there.
 *
 *   POST /api/game/rooms              { code? }          -> { code }   open a room (seat a)
 *   POST /api/game/rooms/:code/join                      -> { ok }     404 if no such room
 *   GET  /api/game/rooms/:code?seat=a                    -> RoomView
 *   POST /api/game/rooms/:code/act    { seat, action }   -> RoomView
 *   POST /api/game/rooms/:code/lens   { seat, to }       -> RoomView  move this seat onto the
 *        glasses showing code `to`, or back to the phone with to: null. 404 if no glasses
 *        are waiting with that code.
 */
import type { RoomView, Seat } from "./types";

export const ROOM_POLL_MS = 700;
export const ROOM_CODE = /^\d{4}$/;

// This package is typechecked without the DOM lib, so the slice of fetch used here is declared.
interface CallInit {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}
declare function fetch(url: string, init?: CallInit): Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;

async function call<T>(path: string, init?: CallInit): Promise<T | null> {
  const res = await fetch(`/api/game/rooms${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`game room ${res.status}`);
  return (await res.json()) as T;
}

export const roomApi = {
  /** Open a room. With a code, opens that one or reuses it if it is already open. */
  async open(code?: string): Promise<string> {
    const res = await call<{ code: string }>("", { method: "POST", body: JSON.stringify(code ? { code } : {}) });
    if (!res) throw new Error("could not open a room");
    return res.code;
  },
  /** False when nobody has opened a room with this code. */
  async join(code: string): Promise<boolean> {
    return (await call<{ ok: true }>(`/${code}/join`, { method: "POST" })) !== null;
  },
  /** null when the room is gone. */
  get(code: string, seat: Seat): Promise<RoomView | null> {
    return call<RoomView>(`/${code}?seat=${seat}`);
  },
  act(code: string, seat: Seat, action: unknown): Promise<RoomView | null> {
    return call<RoomView>(`/${code}/act`, { method: "POST", body: JSON.stringify({ seat, action }) });
  },
  /** Show this seat on the glasses whose code is `to`; null brings it back to the phone. null result: no such glasses. */
  lens(code: string, seat: Seat, to: string | null): Promise<RoomView | null> {
    return call<RoomView>(`/${code}/lens`, { method: "POST", body: JSON.stringify({ seat, to }) });
  },
};
