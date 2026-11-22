/**
 * Games.tsx (glasses-web): the two-player games at the /g/ root.
 *
 * The lens opens a room (POST /api/game/rooms), shows its 4-digit code (Pair) and waits
 * for a phone to enter it at /m. From then on the worker's GameRoom runs the games one
 * after another (Tall tale, First impressions, Left for you) and this component draws
 * whichever one the room is on. "Next game" and "Again" on a game's last screen move both
 * players.
 *
 * A player who started on a phone can move here instead: they type this lens's code into
 * "Play on glasses" at /m, the lens's own room then says `moved`, and the lens plays that
 * seat of the phone's room until the phone takes it back.
 *
 * The code is kept in sessionStorage so a reload stays in the same room.
 *   /g/?room=1234   open (or reuse) a fixed code, handy for a demo table
 *   /g/?join=1234   take the phone's seat from a lens or a desktop window, for testing
 */
import { useEffect, useRef, useState } from "react";
import { ROOM_CODE, roomApi, type Seat } from "@questline/protocol/games";
import { SCREENS } from "./play";
import { useRoom } from "./lib/room";
import { Pair } from "./screens/Pair";
import "./guess.css";

const STORE_KEY = "questline.game.code";
const RETRY_MS = 3000;

function stored(): string | null {
  try {
    return sessionStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

function store(code: string) {
  try {
    sessionStorage.setItem(STORE_KEY, code);
  } catch {
    // no storage: a reload just opens a new room
  }
}

const params = new URLSearchParams(location.search);
const fixed = [params.get("join"), params.get("room")].find((c) => c && ROOM_CODE.test(c)) ?? null;
const seat: Seat = params.get("join") && fixed ? "b" : "a";

export function Games() {
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const opening = useRef(false);
  const home = useRoom(code, seat);
  // A phone handed its seat to this lens: play in that room, as that seat.
  const moved = home.room?.moved ?? null;
  const away = useRoom(moved?.code ?? null, moved?.seat ?? "a");
  const gone = home.gone || (moved !== null && away.gone);

  useEffect(() => {
    if (code || opening.current) return;
    opening.current = true;
    let timer = 0;
    (async () => {
      try {
        let next: string;
        if (seat === "b") next = fixed!;
        else if (fixed) next = await roomApi.open(fixed);
        else {
          const kept = stored();
          next = kept && (await roomApi.get(kept, "a")) ? kept : await roomApi.open();
        }
        store(next);
        setFailed(false);
        setCode(next);
      } catch {
        setFailed(true);
        timer = window.setTimeout(() => setAttempt((n) => n + 1), RETRY_MS);
      } finally {
        opening.current = false;
      }
    })();
    return () => window.clearTimeout(timer);
  }, [code, attempt]);

  // The room is gone (the worker forgot it): open a fresh one.
  useEffect(() => {
    if (!gone) return;
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {
      // ignore
    }
    setCode(null);
  }, [gone]);

  if (!code || !home.room) return <Pair code={null} state={failed ? "error" : "opening"} />;
  if (moved && !away.room) return <Pair code={null} state="opening" />;
  // The phone took the game back (or gave it to other glasses): wait with our own code again.
  const following = moved !== null && away.room?.lens === code;
  const { room, send, serverNow } = following ? away : home;
  if (!room) return null;
  if (!room.gameId || (moved && !following)) return <Pair code={room.code} state="waiting" />;
  if (!room.partnerHere) return <Pair code={room.code} state="away" />;

  const Screen = SCREENS[room.gameId];
  return (
    <Screen
      key={`${room.code}:${room.run}`}
      view={room.game}
      seat={room.seat}
      send={send}
      serverNow={serverNow}
      onNext={() => send({ type: "room.next" })}
      onAgain={() => send({ type: "room.again" })}
    />
  );
}
