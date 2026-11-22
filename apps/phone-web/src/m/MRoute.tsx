import { useEffect, useRef, useState } from "react";
import { ROOM_CODE, roomApi, type RoomView, type Seat } from "@questline/protocol/games";
import type { ReactNode } from "react";
import { Body, Button, Display, Eyebrow, Hint, Screen, TextField, TextLink, Title } from "../ui";
import { SCREENS } from "./games";
import { useRoom } from "./room";
import "./m.css";

/**
 * /m: the phone side of the two-player games. The glasses at /g/ open a room and show a
 * 4-digit code; this page takes the code and joins as the second seat. The worker's
 * GameRoom then runs the games one after another and this draws whichever one is on.
 *
 *   /m              type the code
 *   /m?code=1234    join that room straight away
 *   /m?host         open a room from this phone and show its code, for two phones
 *
 * "Play on glasses" moves this player's screen onto a pair of glasses mid-game: the glasses
 * show a code at /g/, the player types it here, and the glasses carry on as this seat. The
 * phone then waits, takes over again for anything that needs typing, and can bring the
 * game back. The game itself stays in the room on the worker, so nothing is lost or reset.
 *
 * The seat is kept in sessionStorage so a reload stays in the game. It talks to the worker
 * directly (roomApi), not through the app's api layer, so it also works in simulator mode
 * as long as a worker is running.
 */

const STORE_KEY = "questline.game.seat";

interface Joined {
  code: string;
  seat: Seat;
}

function stored(): Joined | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null") as Partial<Joined> | null;
    if (raw && typeof raw.code === "string" && ROOM_CODE.test(raw.code) && (raw.seat === "a" || raw.seat === "b")) {
      return { code: raw.code, seat: raw.seat };
    }
  } catch {
    // no storage, or not ours
  }
  return null;
}

function store(joined: Joined | null) {
  try {
    if (joined) sessionStorage.setItem(STORE_KEY, JSON.stringify(joined));
    else sessionStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
}

/** Screens the glasses cannot do alone, so the phone shows them even while the game is on the glasses. */
function needsTyping(room: RoomView): boolean {
  return room.gameId === "trivia" && (room.game as { phase?: string } | null)?.phase === "leave";
}

function codeDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

function Stage({ code, link, onLink, children }: { code: string; link: string; onLink: () => void; children: ReactNode }) {
  return (
    <div className="m-stage">
      <div className="m-bar">
        <span>Game {code}</span>
        <TextLink small onClick={onLink}>
          {link}
        </TextLink>
      </div>
      <div className="m-stage__game">{children}</div>
    </div>
  );
}

export default function MRoute() {
  const [joined, setJoined] = useState<Joined | null>(stored);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const auto = useRef(false);
  /** The "Play on glasses" screen is open. */
  const [picking, setPicking] = useState(false);
  const [lensCode, setLensCode] = useState("");
  const { room, gone, send, lens, serverNow } = useRoom(joined?.code ?? null, joined?.seat ?? "b");

  const enter = (next: Joined) => {
    store(next);
    setJoined(next);
  };

  const leave = (message: string | null = null) => {
    store(null);
    setJoined(null);
    setCode("");
    setError(message);
    setPicking(false);
  };

  const pick = (open: boolean) => {
    setPicking(open);
    setLensCode("");
    setError(null);
  };

  /** Move this seat onto the glasses showing `to`, or back to this phone with null. */
  const moveTo = async (to: string | null) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (await lens(to)) pick(false);
      else setError("No glasses are showing that code. Check it and try again.");
    } catch {
      setError("Can't reach Questline. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const join = async (value: string) => {
    if (!ROOM_CODE.test(value) || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (await roomApi.join(value)) enter({ code: value, seat: "b" });
      else setError("No game with that code. Check the glasses.");
    } catch {
      setError("Can't reach Questline. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const host = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      enter({ code: await roomApi.open(), seat: "a" });
    } catch {
      setError("Can't reach Questline. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // ?code= and ?host act once, on arrival.
  useEffect(() => {
    if (auto.current || joined) return;
    auto.current = true;
    const params = new URLSearchParams(location.search);
    const wanted = params.get("code");
    if (wanted && ROOM_CODE.test(wanted)) void join(wanted);
    else if (params.has("host")) void host();
  }, []);

  useEffect(() => {
    if (gone) leave("That game has ended. Enter a new code.");
  }, [gone]);

  if (!joined) {
    return (
      <Screen
        label="M-join"
        footer={
          <Button disabled={!ROOM_CODE.test(code) || busy} onClick={() => void join(code)}>
            {busy ? "Joining…" : "Join"}
          </Button>
        }
      >
        <Eyebrow>In This Town games</Eyebrow>
        <Title>Enter the code</Title>
        <Body>Your partner's glasses show a 4-digit code. Type it here to play together.</Body>
        <TextField
          label="Game code"
          value={code}
          onChange={(v) => {
            setCode(codeDigits(v));
            setError(null);
          }}
          placeholder="0000"
          maxLength={4}
          inputMode="numeric"
          autoComplete="off"
          autoFocus
        />
        {error && <Hint>{error}</Hint>}
        <TextLink small onClick={() => void host()} style={{ marginTop: 18 }}>
          No glasses? Start a game on this phone
        </TextLink>
      </Screen>
    );
  }

  if (picking && !room?.lens) {
    return (
      <Screen
        label="M-lens-code"
        footer={
          <>
            <Button disabled={!ROOM_CODE.test(lensCode) || busy} onClick={() => void moveTo(lensCode)}>
              {busy ? "Moving…" : "Move to glasses"}
            </Button>
            <TextLink small onClick={() => pick(false)}>
              Stay on this phone
            </TextLink>
          </>
        }
      >
        <Eyebrow>Game {joined.code}</Eyebrow>
        <Title>Play on glasses</Title>
        <Body>Open {location.host}/g on your glasses. They show a 4-digit code. Type it here and your game moves over.</Body>
        <TextField
          label="Code on your glasses"
          value={lensCode}
          onChange={(v) => {
            setLensCode(codeDigits(v));
            setError(null);
          }}
          placeholder="0000"
          maxLength={4}
          inputMode="numeric"
          autoComplete="off"
          autoFocus
        />
        {error ? <Hint>{error}</Hint> : <Hint>Nothing restarts. Your partner stays where they are.</Hint>}
      </Screen>
    );
  }

  if (room?.lens && !(room.partnerHere && needsTyping(room))) {
    return (
      <Screen
        label="M-lens"
        blobs="b"
        footer={
          <Button variant="secondary" disabled={busy} onClick={() => void moveTo(null)}>
            Bring it back to my phone
          </Button>
        }
      >
        <Eyebrow>Game {joined.code}</Eyebrow>
        <Title size="md">Playing on your glasses</Title>
        <Body>Your game is on your glasses now. Look up and play.</Body>
        <Hint>Keep this phone close. When there is something to type, it shows up here.</Hint>
        {error && <Hint>{error}</Hint>}
      </Screen>
    );
  }

  if (!room || !room.gameId || !room.partnerHere) {
    const hosting = joined.seat === "a";
    return (
      <Screen
        label="M-wait"
        blobs="b"
        footer={
          <>
            {room && (
              <Button variant="secondary" onClick={() => pick(true)}>
                Play on glasses
              </Button>
            )}
            <TextLink small onClick={() => leave()}>
              Leave this game
            </TextLink>
          </>
        }
      >
        <Eyebrow>Game {joined.code}</Eyebrow>
        {room?.gameId ? (
          <Title size="md">Your partner dropped out</Title>
        ) : hosting ? (
          <Title size="md">Give them this code</Title>
        ) : (
          <Title size="md">Joining…</Title>
        )}
        {hosting && !room?.gameId ? (
          <>
            <Display style={{ fontSize: 72, letterSpacing: "0.08em" }}>{joined.code}</Display>
            <Body>On the other phone, open {location.host}/m and enter it.</Body>
          </>
        ) : (
          <Body>{room?.gameId ? "Waiting for them to come back." : "Waiting for the glasses."}</Body>
        )}
      </Screen>
    );
  }

  const Game = SCREENS[room.gameId];
  return (
    <Stage
      code={joined.code}
      link={room.lens ? "Bring it back to my phone" : "Play on glasses"}
      onLink={() => (room.lens ? void moveTo(null) : pick(true))}
    >
      <Game
        key={room.run}
        view={room.game}
        seat={room.seat}
        send={send}
        serverNow={serverNow}
        onNext={() => send({ type: "room.next" })}
        onAgain={() => send({ type: "room.again" })}
      />
    </Stage>
  );
}
