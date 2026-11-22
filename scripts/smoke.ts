// End-to-end smoke test of the happy path against a running worker (DEMO_MODE on).
// It asks GET /api/health which flow the worker runs and checks that one: with GAMES_ONLY
// (D26) a match leads to the two-player games; otherwise to a kiosk mission and a stamp.
// Usage: pnpm smoke            (worker on http://localhost:8787, KIOSK_KEY from apps/worker/.dev.vars)
//        WORKER_URL=https://<host> KIOSK_KEY=... pnpm smoke
//
// Plays: two riders (Andres in car 1412, Maya in 1413), Andres's glasses, the kiosk screen
// and Pi in car 1413. Walks through onboarding, glasses link, check-in, match, walking to the
// kiosk, then the games (or mission, two-tap stamp, passport). Exits non-zero on the first
// thing that's wrong.
import { readFileSync } from "node:fs";
import type { Profile, ServerToKiosk, ServerToRider, TapRes } from "@questline/protocol";
import { IMPRESSIONS_ROUNDS, TRIVIA_ROUNDS } from "@questline/protocol/games";

const BASE = (process.env.WORKER_URL ?? "http://localhost:8787").replace(/\/+$/, "");
const WS_BASE = BASE.replace(/^http/, "ws");
const KIOSK_KEY = process.env.KIOSK_KEY ?? devVar("KIOSK_KEY");
/** The trip's last stop and the stop two ahead, read from the first tap so either DEMO_LINE works. */
let DEST = "";
let TWO_STOPS_ON = "";

function devVar(name: string): string {
  try {
    const line = readFileSync(new URL("../apps/worker/.dev.vars", import.meta.url), "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1).replace(/^"|"$/g, "") ?? "";
  } catch {
    return "";
  }
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}
const ok = (msg: string) => console.log(`✓ ${msg}`);

async function api<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    // The kiosk key lets our own tooling past the per-IP rate limits (apps/worker/src/lib/rateLimit.ts).
    headers: { "content-type": "application/json", "x-kiosk-key": KIOSK_KEY, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${path} -> ${res.status} ${text}`);
  return JSON.parse(text) as T;
}

/** A socket that records every message and can wait for one matching a predicate. */
class Sock<E extends { type: string }> {
  events: E[] = [];
  private waiters: { pred: (e: E) => boolean; resolve: (e: E) => void }[] = [];
  private ws: WebSocket;
  constructor(url: string, hello: object, readonly name: string) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.ws.send(JSON.stringify(hello));
    this.ws.onmessage = (m) => {
      const e = JSON.parse(String(m.data)) as E;
      this.events.push(e);
      for (const w of [...this.waiters]) {
        if (w.pred(e)) {
          this.waiters.splice(this.waiters.indexOf(w), 1);
          w.resolve(e);
        }
      }
    };
    this.ws.onclose = (c) => {
      if (c.code !== 1000 && c.code !== 4000) console.log(`  (${name} closed ${c.code} ${c.reason})`);
    };
  }
  send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }
  wait<T extends E["type"]>(type: T, ms = 8000, pred: (e: Extract<E, { type: T }>) => boolean = () => true) {
    const seen = this.events.find((e) => e.type === type && pred(e as Extract<E, { type: T }>));
    if (seen) return Promise.resolve(seen as Extract<E, { type: T }>);
    return new Promise<Extract<E, { type: T }>>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${this.name}: no ${type} within ${ms} ms`)), ms);
      this.waiters.push({
        pred: (e) => e.type === type && pred(e as Extract<E, { type: T }>),
        resolve: (e) => {
          clearTimeout(t);
          resolve(e as Extract<E, { type: T }>);
        },
      });
    });
  }
  close() {
    this.ws.close(1000);
  }
}

const profile = (firstName: string, interests: Profile["interests"]): Profile => ({
  firstName,
  interests,
  askMeAbout: "",
  socialBattery: "chat",
  status: "student",
  languages: [],
  is18Plus: true,
});

async function main() {
  if (!KIOSK_KEY) fail("set KIOSK_KEY (or put it in apps/worker/.dev.vars)");
  await fetch(`${BASE}/api/demo/reset`, { method: "POST", headers: { "x-kiosk-key": KIOSK_KEY } });
  const health = await api<{ gamesOnly?: boolean }>("GET", "/api/health");
  const GAMES_ONLY = health.gamesOnly === true;
  console.log(GAMES_ONLY ? "Worker runs games-only (D26): checking the game flow.\n" : "Worker runs kiosk missions: checking the mission flow.\n");

  // Onboarding
  const andres = await api<{ userId: string; token: string }>("POST", "/api/users", profile("Andres", ["ramen", "film", "hackathons"]));
  const maya = await api<{ userId: string; token: string }>("POST", "/api/users", profile("Maya", ["ramen", "film", "coffee"]));
  ok("created two riders");

  // Glasses link: code on the lens, typed on the phone, glasses poll with the secret.
  const code = await api<{ code: string; pollSecret: string }>("POST", "/api/glasses/code");
  const before = await api<{ linked: boolean }>("GET", `/api/glasses/code/${code.code}?secret=${code.pollSecret}`);
  if (before.linked) fail("code linked before the phone entered it");
  await api("POST", "/api/glasses/link", { code: code.code }, andres.token);
  const linked = await api<{ linked: boolean; token?: string }>("GET", `/api/glasses/code/${code.code}?secret=${code.pollSecret}`);
  if (!linked.linked || !linked.token) fail("glasses did not get a token after linking");
  const again = await fetch(`${BASE}/api/glasses/code/${code.code}?secret=${code.pollSecret}`);
  if (again.status !== 410) fail(`second poll should be 410, got ${again.status}`);
  const me = await api<{ glassesLinked: boolean }>("GET", "/api/me", undefined, andres.token);
  if (!me.glassesLinked) fail("/api/me does not show glasses linked");
  ok(`glasses linked with code ${code.code}`);

  // Kiosk in car 1413: screen + Pi with a dynamic tag.
  const screen = new Sock<ServerToKiosk>(`${WS_BASE}/ws/kiosk/1413?key=${KIOSK_KEY}&role=screen`, { type: "kiosk.hello", car: "1413", role: "screen" }, "kiosk screen");
  const pi = new Sock<ServerToKiosk>(`${WS_BASE}/ws/kiosk/1413?key=${KIOSK_KEY}&role=pi`, { type: "kiosk.hello", car: "1413", role: "pi", hw: { leds: true, nfc: "dynamic" } }, "kiosk pi");
  await screen.wait("kiosk.idle");
  ok("kiosk 1413 connected");

  // Andres boards car 1412.
  const first = await api<TapRes>("POST", "/api/taps", { car: "1412" }, andres.token);
  if (first.result !== "need-destination") fail(`first tap should ask for a destination, got ${first.result}`);
  if (first.stops.length < 3) fail(`expected the demo trip's stops, got ${JSON.stringify(first.stops)}`);
  DEST = first.stops.at(-1)!.id;
  TWO_STOPS_ON = first.stops[1]!.id;
  ok(`demo trip on ${first.line}: riding to ${first.stops.at(-1)!.name}`);
  // Ride Mode is the consent: a destination alone must not check anyone in.
  const noConsent = await api<TapRes>("POST", "/api/taps", { car: "1412", destinationStop: DEST }, andres.token);
  if (noConsent.result !== "need-destination") fail(`check-in without rideMode should be refused, got ${noConsent.result}`);
  ok("no check-in without Ride Mode consent");
  const checkin = await api<TapRes>("POST", "/api/taps", { car: "1412", destinationStop: DEST, rideMode: true }, andres.token);
  if (checkin.result !== "checked-in") fail(`expected checked-in, got ${JSON.stringify(checkin)}`);
  ok(`Andres checked in: car ${checkin.state.car}, next stop ${checkin.state.nextStop} (${checkin.state.nextStopId})`);

  const phone = new Sock<ServerToRider>(`${WS_BASE}/ws/rider?token=${andres.token}`, { type: "rider.hello", client: "phone" }, "Andres phone");
  const glasses = new Sock<ServerToRider>(`${WS_BASE}/ws/rider?token=${linked.token}`, { type: "rider.hello", client: "glasses" }, "Andres glasses");
  await glasses.wait("ride.snapshot");
  ok("phone and glasses sockets open");

  // Maya boards car 1413: they should be matched with no accept step.
  const mayaTap = await api<TapRes>("POST", "/api/taps", { car: "1413", destinationStop: DEST, rideMode: true }, maya.token);
  if (mayaTap.result !== "checked-in") fail(`Maya: expected checked-in, got ${JSON.stringify(mayaTap)}`);
  const mayaSock = new Sock<ServerToRider>(`${WS_BASE}/ws/rider?token=${maya.token}`, { type: "rider.hello", client: "phone" }, "Maya phone");
  const match = await glasses.wait("match.found");
  ok(`glasses: "${match.partner.firstName}, ${match.why}" -> car ${match.meetAtCar}, carDelta ${match.carDelta}, youWalk ${match.youWalk}`);
  if (match.meetAtCar !== "1413" || !match.youWalk || match.carDelta !== 1) fail("Andres should walk 1 car forward to 1413");
  const incoming = await screen.wait("pair.incoming");
  ok(`kiosk 1413: ${incoming.firstNames.join(" & ")} in ${incoming.color}`);
  const mayaSnap = await mayaSock.wait("ride.snapshot");
  // The pair gets one game room, a seat each, so both phones can open /m without a code.
  const mayaGame = mayaSnap.snapshot.match?.game;
  if (!match.game || !mayaGame || match.game.code !== mayaGame.code || match.game.seat === mayaGame.seat) {
    fail(`expected one game room with a seat each, got ${JSON.stringify([match.game, mayaGame])}`);
  }
  for (const seat of [match.game.seat, mayaGame.seat]) await api("GET", `/api/game/rooms/${match.game.code}?seat=${seat}`);
  ok(`game room ${match.game.code}: Andres seat ${match.game.seat}, Maya seat ${mayaGame.seat}`);

  // Andres walks to 1413 and taps its tag: that's arriving.
  const walk = await api<TapRes>("POST", "/api/taps", { car: "1413" }, andres.token);
  if (walk.result !== "moved-car") fail(`expected moved-car, got ${JSON.stringify(walk)}`);
  /** Where the pair got their stamp (a mission, or finishing the games in games-only). */
  let stampStationId: string | null = null;
  if (GAMES_ONLY) {
    // D26: arriving starts no mission; the pair plays the games in their room instead.
    await screen.wait("pair.incoming", 8000, (e) => e.arrived >= 1);
    await new Promise((r) => setTimeout(r, 1500));
    if (glasses.events.some((e) => e.type === "mission.start")) fail("games-only: a kiosk mission started");
    const room = match.game!;
    await api("POST", `/api/game/rooms/${room.code}/act`, { seat: room.seat, action: { type: "ready", phase: "intro" } });
    const view = await api<{ gameId: string | null; game: { phase?: string } }>("POST", `/api/game/rooms/${room.code}/act`, {
      seat: mayaGame.seat,
      action: { type: "ready", phase: "intro" },
    });
    if (view.gameId !== "tale" || view.game.phase !== "think") fail(`both ready should start Tall tale, got ${JSON.stringify(view)}`);
    ok("games only: arriving starts no mission, and the pair is playing Tall tale in their room");

    // D28: play all three games to the end through both seats. Finishing the last one stamps
    // both riders, celebrates on the kiosk and frees it, then rests them before a rematch.
    type View = {
      gameId: string | null;
      done: boolean;
      last: boolean;
      finished: boolean;
      run: number;
      votes: { you: string | null; partner: string | null };
      game: Record<string, unknown> & { phase?: string };
    };
    const seats = [room.seat, mayaGame.seat] as const;
    const act = (seat: string, action: object) => api<View>("POST", `/api/game/rooms/${room.code}/act`, { seat, action });
    const look = (seat: string) => api<View>("GET", `/api/game/rooms/${room.code}?seat=${seat}`);
    const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
    /** Poll both seats (as their phones would) until `pred` holds for the first seat's view. */
    const until = async (what: string, pred: (v: View) => boolean, ms = 30_000) => {
      const end = Date.now() + ms;
      for (;;) {
        const [v] = await Promise.all(seats.map(look));
        if (pred(v!)) return v!;
        if (Date.now() > end) fail(`games: ${what} (last view ${JSON.stringify(v)})`);
        await pause(400);
      }
    };
    const both = async (action: object) => {
      for (const seat of seats) await act(seat, action);
    };

    // Tall tale: ready through thinking, each teller says done (after the leftover-tap guard), both call.
    await both({ type: "ready", phase: "think" });
    await until("tale reaches the first story", (v) => v.game.phase === "tell");
    for (const turn of [0, 1]) {
      await pause(3200);
      await both({ type: "done", turn });
    }
    await until("tale reaches the verdict", (v) => v.game.phase === "verdict");
    await pause(1200);
    await both({ type: "call", call: "truth" });
    await until("tale reveals", (v) => v.done);
    // The end-of-game buttons are votes: one pick waits, the same pick from both moves on.
    const lone = await act(room.seat, { type: "room.next" });
    if (lone.gameId !== "tale" || lone.votes.you !== "next" || lone.votes.partner !== null) {
      fail(`games: one player's Next game should wait for the other: ${JSON.stringify({ gameId: lone.gameId, votes: lone.votes })}`);
    }
    const split = await act(mayaGame.seat, { type: "room.again" });
    if (split.gameId !== "tale" || split.run !== lone.run) fail(`games: Next game vs Again should not move the room: ${JSON.stringify(split)}`);
    await act(mayaGame.seat, { type: "room.next" });
    ok("games only: Next game waits until both players pick it");

    // First impressions: IMPRESSIONS_ROUNDS of lock, rate, and the short wait after both rated.
    await until("impressions starts", (v) => v.gameId === "impressions");
    await both({ type: "ready" });
    for (let round = 0; round < IMPRESSIONS_ROUNDS; round++) {
      await until(`impressions round ${round + 1} guess`, (v) => v.game.phase === "guess" || v.done);
      await both({ type: "lock", value: 0 });
      await until(`impressions round ${round + 1} talk`, (v) => v.game.phase === "talk");
      await both({ type: "rate", rating: "spot" }); // valid on every question, pick-of-two included
      await until(`impressions round ${round + 1} ends`, (v) => v.game.phase !== "talk" || v.game.round !== round);
    }
    await until("impressions finishes", (v) => v.done);
    await both({ type: "room.next" });

    // Left for you: answer TRIVIA_ROUNDS questions, step past each reveal, then skip leaving one.
    await until("trivia starts", (v) => v.gameId === "trivia");
    await both({ type: "ready" });
    for (let q = 0; q < TRIVIA_ROUNDS; q++) {
      await until(`trivia question ${q + 1}`, (v) => v.game.phase === "question" && v.game.index === q);
      await act(room.seat, { type: "lock", q, choice: 0 });
      await act(mayaGame.seat, { type: "next", q });
    }
    await until("trivia asks to leave a question", (v) => v.game.phase === "leave");
    await act(room.seat, { type: "skip" });
    const end = await until("trivia finishes", (v) => v.done);
    if (!end.last || end.finished) fail(`games: Left for you should be the last game and wait for Finish, got ${JSON.stringify(end)}`);
    ok("games only: the pair played Tall tale, First impressions and Left for you to the end");
    // The last game ends with Finish (it would also finish by itself after 20 s). Then nothing restarts it.
    const half = await act(mayaGame.seat, { type: "room.finish" });
    if (half.finished) fail("games: one Finish ended the room; both should have to pick it");
    const over = await act(room.seat, { type: "room.finish" });
    if (!over.finished) fail(`games: Finish did not end the room: ${JSON.stringify(over)}`);
    for (const type of ["room.next", "room.again"]) {
      const still = await act(room.seat, { type });
      if (!still.finished || still.gameId !== "trivia") fail(`games: ${type} restarted a finished room: ${JSON.stringify(still)}`);
    }
    ok("games only: Finish needs both players, ends the room, and Next game / Again can't restart it");

    const andresStamp = await phone.wait("stamp.awarded", 10_000);
    await mayaSock.wait("stamp.awarded", 10_000);
    await screen.wait("celebrate", 10_000);
    await phone.wait("match.cleared", 10_000, (e) => e.reason === "mission-done");
    await screen.wait("pair.cleared", 15_000);
    stampStationId = andresStamp.stamp.stationId;
    ok(`games only: finishing stamped both at ${andresStamp.stamp.station}, the kiosk celebrated and is free again`);

    const passport = await api<{ stamps: unknown[]; peopleMet: number }>("GET", "/api/passport", undefined, andres.token);
    if (passport.stamps.length !== 1 || passport.peopleMet !== 1) fail(`games-only passport: ${JSON.stringify(passport)}`);
    const rested = await api<{ match: unknown }>("GET", "/api/ride/state", undefined, andres.token);
    if (rested.match) fail("games only: the pair was re-matched during the rest after finishing");
    ok("games only: passport has the stamp and 1 person met; no rematch during the rest");
  } else {
    const started = await glasses.wait("mission.start");
    const show = await screen.wait("mission.show");
    const write = await pi.wait("nfc.write", 8000, (e) => e.url.includes("?n="));
    ok(`mission "${started.mission.title}": ${show.mission.prompt}`);
    const nonce = new URL(write.url).searchParams.get("n") ?? "";
    pi.send({ type: "nfc.written", writeId: write.writeId, url: write.url });

    // A stale tap (no nonce) is refused, then both tap with the fresh nonce.
    const stale = await api<TapRes>("POST", "/api/taps", { car: "1413" }, maya.token);
    if (stale.result !== "error") fail(`a tap without the fresh nonce should fail, got ${stale.result}`);
    const t1 = await api<TapRes>("POST", "/api/taps", { car: "1413", nonce }, maya.token);
    if (t1.result !== "stamp-pending") fail(`first tap: expected stamp-pending, got ${JSON.stringify(t1)}`);
    await screen.wait("stamp.progress");
    const t2 = await api<TapRes>("POST", "/api/taps", { car: "1413", nonce }, andres.token);
    if (t2.result !== "stamp-awarded") fail(`second tap: expected stamp-awarded, got ${JSON.stringify(t2)}`);
    await mayaSock.wait("stamp.awarded");
    await screen.wait("celebrate");
    ok(`stamp: ${t2.stamp.station} (${t2.stamp.stationId}) with ${t2.stamp.partnerFirstName}`);
    await phone.wait("match.cleared");
    await screen.wait("pair.cleared", 12000);
    ok("pair cleared after the celebration");

    const passport = await api<{ stamps: unknown[]; peopleMet: number }>("GET", "/api/passport", undefined, andres.token);
    if (passport.stamps.length !== 1 || passport.peopleMet !== 1) fail(`passport: ${JSON.stringify(passport)}`);
    ok("passport has 1 stamp, 1 person met");
    stampStationId = t2.stamp.stationId;
  }

  // Not now from the phone on a fresh rider, then end the ride.
  const lena = await api<{ userId: string; token: string }>("POST", "/api/users", profile("Lena", ["film", "coffee", "chess"]));
  await api<TapRes>("POST", "/api/taps", { car: "1412", destinationStop: DEST, rideMode: true }, lena.token);
  // Andres and Maya just played, so they're not eligible until the next stop: no match yet.
  await api("POST", "/api/ride/end", undefined, lena.token);
  await api("POST", "/api/ride/end", undefined, maya.token);
  await api("POST", "/api/ride/end", undefined, andres.token);
  const off = await api<{ state: { status: string } }>("GET", "/api/ride/state", undefined, andres.token);
  if (off.state.status !== "off") fail(`after ride/end, status should be off, got ${off.state.status}`);
  ok("rides ended");

  // History, profile edits, mood.
  type Recent = { matches: { matchId: string; partnerFirstName: string; color: string; stamped: boolean; stationId: string | null; blocked: boolean }[] };
  const recent = await api<Recent>("GET", "/api/matches/recent", undefined, andres.token);
  if (recent.matches[0]?.partnerFirstName !== "Maya" || !recent.matches[0]?.stamped) fail(`recent matches: ${JSON.stringify(recent)}`);
  if (recent.matches[0]?.stationId !== stampStationId) fail(`recent match should say where you met (${stampStationId}): ${JSON.stringify(recent.matches[0])}`);

  // Block Maya from People, see it on the server, then unblock (later steps pair them again).
  const metMaya = recent.matches[0]!.matchId;
  await api("POST", "/api/report", { matchId: metMaya, reason: "Blocked from People", block: true }, andres.token);
  const afterBlock = await api<Recent>("GET", "/api/matches/recent", undefined, andres.token);
  if (!afterBlock.matches.find((m) => m.matchId === metMaya)?.blocked) fail("block did not show in recent matches");
  await api("POST", "/api/unblock", { matchId: metMaya }, andres.token);
  const afterUnblock = await api<Recent>("GET", "/api/matches/recent", undefined, andres.token);
  if (afterUnblock.matches.find((m) => m.matchId === metMaya)?.blocked !== false) fail("unblock did not lift the block");
  ok("People: where you met, block and unblock round-trip through the worker");
  const edited = await api<{ profile: { firstName: string; interests: string[] } }>("PATCH", "/api/me", { firstName: "Dre", interests: ["ramen", "film", "chess"] }, andres.token);
  if (edited.profile.firstName !== "Dre" || !edited.profile.interests.includes("chess")) fail(`PATCH /api/me: ${JSON.stringify(edited)}`);
  await api("POST", "/api/ride/mood", { mood: "talk" }, andres.token);
  const meNow = await api<{ profile: { socialBattery: string } }>("GET", "/api/me", undefined, andres.token);
  if (meNow.profile.socialBattery !== "talk") fail("mood did not stick");
  ok("recent matches, profile edit and mood work");

  // Same car + "I'm here" from the phone + Not now.
  const kai = await api<{ userId: string; token: string }>("POST", "/api/users", profile("Kai", ["chess", "anime", "coffee"]));
  const zoe = await api<{ userId: string; token: string }>("POST", "/api/users", profile("Zoe", ["chess", "anime", "baking"]));
  await api<TapRes>("POST", "/api/taps", { car: "1412", destinationStop: DEST, rideMode: true }, kai.token);
  await api<TapRes>("POST", "/api/taps", { car: "1412", destinationStop: DEST, rideMode: true }, zoe.token);
  const kaiSock = new Sock<ServerToRider>(`${WS_BASE}/ws/rider?token=${kai.token}`, { type: "rider.hello", client: "phone" }, "Kai phone");
  const zoeSock = new Sock<ServerToRider>(`${WS_BASE}/ws/rider?token=${zoe.token}`, { type: "rider.hello", client: "phone" }, "Zoe phone");
  const snap = await kaiSock.wait("ride.snapshot");
  if (!snap.snapshot.match || snap.snapshot.match.carDelta !== 0) fail(`Kai and Zoe should be matched in their own car: ${JSON.stringify(snap.snapshot.match)}`);
  await api("POST", "/api/ride/arrived", undefined, kai.token);
  if (!GAMES_ONLY) {
    await kaiSock.wait("mission.start");
    ok("same-car pair: \"I'm here\" started the mission");
  }
  await api("POST", "/api/ride/not-now", undefined, zoe.token);
  const cleared = await kaiSock.wait("match.cleared");
  const mine = await zoeSock.wait("match.cleared");
  if (cleared.reason !== "partner-not-now" || mine.reason !== "you-not-now") fail(`not-now reasons: ${cleared.reason} / ${mine.reason}`);
  if (!GAMES_ONLY) await kaiSock.wait("mission.end", 8000, (e) => e.reason === "cancelled");
  ok(GAMES_ONLY ? "same-car pair: Not now cleared the pair" : "Not now cleared the pair and cancelled the mission");

  // A report mid-match: the pair ends, the reported rider only hears their partner left, and
  // the two are never matched again on this trip.
  const ivy = await api<{ userId: string; token: string }>("POST", "/api/users", profile("Ivy", ["cycling", "robotics", "history"]));
  const max = await api<{ userId: string; token: string }>("POST", "/api/users", profile("Max", ["cycling", "robotics", "cannoli"]));
  await api<TapRes>("POST", "/api/taps", { car: "1412", destinationStop: DEST, rideMode: true }, ivy.token);
  await api<TapRes>("POST", "/api/taps", { car: "1412", destinationStop: DEST, rideMode: true }, max.token);
  const ivySock = new Sock<ServerToRider>(`${WS_BASE}/ws/rider?token=${ivy.token}`, { type: "rider.hello", client: "phone" }, "Ivy phone");
  const maxSock = new Sock<ServerToRider>(`${WS_BASE}/ws/rider?token=${max.token}`, { type: "rider.hello", client: "phone" }, "Max phone");
  const ivySnap = await ivySock.wait("ride.snapshot");
  if (!ivySnap.snapshot.match) fail("Ivy and Max should be matched");
  await maxSock.wait("ride.snapshot");
  await api("POST", "/api/report", { matchId: ivySnap.snapshot.match!.matchId, reason: "Made me uncomfortable", block: false }, ivy.token);
  const ivyCleared = await ivySock.wait("match.cleared");
  const maxCleared = await maxSock.wait("match.cleared");
  if (ivyCleared.reason !== "reported" || maxCleared.reason !== "partner-left") fail(`report reasons: ${ivyCleared.reason} / ${maxCleared.reason}`);
  const ivyAfter = await api<{ match: unknown }>("GET", "/api/ride/state", undefined, ivy.token);
  const maxAfter = await api<{ match: unknown }>("GET", "/api/ride/state", undefined, max.token);
  if (ivyAfter.match || maxAfter.match) fail(`a reported pair was matched again: ${JSON.stringify([ivyAfter.match, maxAfter.match])}`);
  await api("POST", "/api/ride/end", undefined, ivy.token);
  await api("POST", "/api/ride/end", undefined, max.token);
  ok("a report ends the pair, tells the reported rider only that their partner left, and never re-pairs them");

  // Late-train bonus: a scripted delay unlocks it for the next mission (missions only).
  const demo = (path: string, body: object = {}) =>
    fetch(`${BASE}/api/demo/${path}`, { method: "POST", headers: { "x-kiosk-key": KIOSK_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!GAMES_ONLY && !(await demo("delay", { seconds: 240 })).ok) fail("demo delay failed");
  const ana = await api<{ userId: string; token: string }>("POST", "/api/users", profile("Ana", ["rowing", "trivia", "comics"]));
  const ben = await api<{ userId: string; token: string }>("POST", "/api/users", profile("Ben", ["rowing", "trivia", "museums"]));
  await api<TapRes>("POST", "/api/taps", { car: "1412", destinationStop: TWO_STOPS_ON, rideMode: true }, ana.token);
  await api<TapRes>("POST", "/api/taps", { car: "1412", destinationStop: TWO_STOPS_ON, rideMode: true }, ben.token);
  const anaSock = new Sock<ServerToRider>(`${WS_BASE}/ws/rider?token=${ana.token}`, { type: "rider.hello", client: "phone" }, "Ana phone");
  await anaSock.wait("ride.snapshot");
  if (!GAMES_ONLY) {
    await api("POST", "/api/ride/arrived", undefined, ana.token);
    const bonus = await anaSock.wait("mission.start");
    if (bonus.mission.category !== "late-bonus") fail(`expected a late-bonus mission, got ${bonus.mission.category}`);
    ok(`late-train bonus: "${bonus.mission.title}"`);
  }

  // Advance the demo train two stops to Ana and Ben's stop. With missions they get
  // checked out there; games-only (D26) keeps a pair playing whatever stops they picked.
  await demo("advance");
  await demo("advance");
  const gone = await api<{ state: { status: string } }>("GET", "/api/ride/state", undefined, ana.token);
  if (GAMES_ONLY) {
    if (gone.state.status === "off") fail("games-only: Ana was checked out at her stop mid-game");
    await api("POST", "/api/ride/end", undefined, ana.token);
    await api("POST", "/api/ride/end", undefined, ben.token);
    ok("games only: passing a rider's stop doesn't end their game");
  } else {
    if (gone.state.status !== "off") fail(`Ana should be off at her stop, got ${gone.state.status}`);
    ok("riders are checked out at their stop");
  }

  // Delete my data: signs out every device.
  await api("DELETE", "/api/me", undefined, kai.token);
  const afterDelete = await fetch(`${BASE}/api/me`, { headers: { authorization: `Bearer ${kai.token}` } });
  if (afterDelete.status !== 401) fail(`deleted rider's token should stop working, got ${afterDelete.status}`);
  ok("delete my data signs the rider out");

  for (const s of [phone, glasses, mayaSock, screen, pi, kaiSock, zoeSock, ivySock, maxSock, anaSock]) s.close();
  await demo("reset");
  console.log("\nAll good.");
  process.exit(0);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
