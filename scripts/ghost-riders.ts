// Ghost riders: seeded users riding the demo train so the kiosks and matching look alive,
// and so one person can demo a full match + mission + stamp alone.
// Usage: pnpm seed && pnpm ghosts [--count 3] [--car 1413] [--dest gov-ctr] [--auto]
//   --auto   ghosts walk to the meeting kiosk and tap for the stamp on their own. Stamping
//            only works on a static-tag kiosk: a ghost can't read the fresh nonce off a real tag.
//   Ctrl+C   ends every ghost's ride
//
// Ghosts are ordinary riders using their seeded tokens. WORKER_URL defaults to http://localhost:8787.
import { readFileSync } from "node:fs";
import type { ServerToRider, TapRes } from "@questline/protocol";

export const DEMO_CARS = ["1412", "1413"] as const;

const BASE = (process.env.WORKER_URL ?? "http://localhost:8787").replace(/\/+$/, "");
const WS_BASE = BASE.replace(/^http/, "ws");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const COUNT = Number(arg("count") ?? 3);
const CAR = arg("car") ?? "1413";
const DEST = arg("dest") ?? "gov-ctr";
const AUTO = process.argv.includes("--auto");

interface Ghost {
  firstName: string;
  token: string;
  ws?: WebSocket;
  car: string;
}

async function tap(g: Ghost, body: { car: string; nonce?: string; destinationStop?: string }): Promise<TapRes> {
  const res = await fetch(`${BASE}/api/taps`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${g.token}` },
    body: JSON.stringify(body),
  });
  return (await res.json()) as TapRes;
}

function log(g: Ghost, msg: string) {
  console.log(`[${g.firstName}] ${msg}`);
}

async function onEvent(g: Ghost, e: ServerToRider) {
  switch (e.type) {
    case "match.found":
      log(g, `matched with ${e.partner.firstName} (${e.partner.color}) at car ${e.meetAtCar}: ${e.why}`);
      if (AUTO && e.youWalk) {
        setTimeout(() => {
          void tap(g, { car: e.meetAtCar }).then((r) => log(g, `walked to ${e.meetAtCar}: ${r.result}`));
          g.car = e.meetAtCar;
        }, 3000);
      }
      return;
    case "mission.start":
      log(g, `mission "${e.mission.title}": ${e.mission.prompt}`);
      if (AUTO) setTimeout(() => void tap(g, { car: g.car }).then((r) => log(g, `stamp tap: ${r.result}`)), 10_000);
      return;
    case "stamp.awarded":
      log(g, `stamp at ${e.stamp.station}`);
      return;
    case "match.cleared":
      log(g, `match cleared (${e.reason})`);
      return;
    case "mission.end":
      log(g, `mission ended (${e.reason})`);
      return;
    default:
      return;
  }
}

function connect(g: Ghost) {
  const ws = new WebSocket(`${WS_BASE}/ws/rider?token=${g.token}`);
  g.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ type: "rider.hello", client: "phone" }));
  ws.onmessage = (m) => void onEvent(g, JSON.parse(String(m.data)) as ServerToRider);
  ws.onclose = (c) => {
    if (c.code === 4000) log(g, "checked out");
  };
  setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), 25_000);
}

async function main(): Promise<void> {
  let seeded: { firstName: string; token: string }[];
  try {
    seeded = JSON.parse(readFileSync(new URL("./.seed-tokens.json", import.meta.url), "utf8"));
  } catch {
    throw new Error("no scripts/.seed-tokens.json: run `pnpm seed` first");
  }
  const ghosts: Ghost[] = seeded.slice(0, COUNT).map((s) => ({ ...s, car: CAR }));
  for (const g of ghosts) {
    const r = await tap(g, { car: g.car, destinationStop: DEST });
    log(g, `boarded car ${g.car}: ${r.result}${r.result === "error" ? ` (${r.message})` : ""}`);
    if (r.result === "checked-in" || r.result === "moved-car") connect(g);
  }
  console.log(`${ghosts.length} ghosts riding${AUTO ? " (auto)" : ""}. Ctrl+C to end their rides.`);

  process.on("SIGINT", async () => {
    for (const g of ghosts) {
      await fetch(`${BASE}/api/ride/end`, { method: "POST", headers: { authorization: `Bearer ${g.token}` } });
      g.ws?.close(1000);
    }
    console.log("ended all ghost rides");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
