/**
 * room.ts (phone-web): the game room this phone is playing in (the games at /m).
 *
 * `useRoom` polls GET /api/game/rooms/:code (roomApi in @questline/protocol/games) a little
 * under once a second and posts actions. Polling, not a socket, to match the glasses, whose
 * browser may not have WebSockets. The returned `room` keeps its identity while nothing
 * in it changes, so it is safe as an effect dependency.
 *
 * `lens(to)` moves this seat's screen onto the glasses showing code `to` (null brings it
 * back); false means no glasses are waiting with that code.
 *
 * `useSecondsLeft` counts down to a deadline given in server time.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ROOM_POLL_MS, roomApi, type RoomView, type Seat } from "@questline/protocol/games";

export function useRoom(code: string | null, seat: Seat) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [gone, setGone] = useState(false);
  const offset = useRef(0);
  // Requests are numbered when sent; an answer older than one already shown is dropped.
  const sent = useRef(0);
  const shown = useRef(0);
  const last = useRef("");

  const show = useCallback((n: number, view: RoomView | null) => {
    if (n < shown.current) return;
    shown.current = n;
    if (!view) return setGone(true);
    offset.current = view.now - Date.now();
    const same = JSON.stringify({ ...view, now: 0 });
    if (same === last.current) return;
    last.current = same;
    setRoom(view);
  }, []);

  useEffect(() => {
    setRoom(null);
    setGone(false);
    last.current = "";
    if (!code) return;
    let alive = true;
    const poll = () => {
      const n = ++sent.current;
      roomApi.get(code, seat).then(
        (view) => alive && show(n, view),
        () => {}, // offline for a moment: keep the last view and try again
      );
    };
    poll();
    const id = window.setInterval(poll, ROOM_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [code, seat, show]);

  const send = useCallback(
    (action: unknown) => {
      if (!code) return;
      const n = ++sent.current;
      roomApi.act(code, seat, action).then(
        (view) => show(n, view),
        () => {},
      );
    },
    [code, seat, show],
  );

  const lens = useCallback(
    async (to: string | null): Promise<boolean> => {
      if (!code) return false;
      const n = ++sent.current;
      const view = await roomApi.lens(code, seat, to);
      if (view) show(n, view);
      return view !== null;
    },
    [code, seat, show],
  );

  const serverNow = useCallback(() => Date.now() + offset.current, []);

  return { room, gone, send, lens, serverNow };
}

/** Whole seconds until `deadline` (server epoch ms), never below 0. null deadline gives null. */
export function useSecondsLeft(deadline: number | null | undefined, serverNow: () => number): number | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [deadline]);
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
}

/**
 * True once server time reaches `opensAt` (null/undefined: always open). Re-renders at that
 * moment, so a button held back for the leftover-tap guard turns on by itself.
 */
export function useOpensAt(opensAt: number | null | undefined, serverNow: () => number): boolean {
  const [, tick] = useState(0);
  const open = opensAt == null || serverNow() >= opensAt;
  useEffect(() => {
    if (open || opensAt == null) return;
    const id = window.setTimeout(() => tick((n) => n + 1), Math.max(0, opensAt - serverNow()) + 20);
    return () => window.clearTimeout(id);
  }, [open, opensAt, serverNow]);
  return open;
}
