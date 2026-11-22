/**
 * room.ts (glasses-web): the game room this lens is playing in.
 *
 * `useRoom` polls GET /api/game/rooms/:code (roomApi in @questline/protocol/games) a little
 * under once a second and posts actions. Polling, not a socket, because WebSockets are not
 * confirmed in the glasses browser. The returned `room` keeps its identity while nothing
 * in it changes, so it is safe as an effect dependency.
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

  const serverNow = useCallback(() => Date.now() + offset.current, []);

  return { room, gone, send, serverNow };
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
