/**
 * index.ts: the Worker entry. One origin serves everything (decision D12).
 *
 * Routing (architecture.md "One origin, one Worker"):
 *   /api/*            REST (Hono sub-apps in routes/). Unknown /api paths -> JSON 404.
 *   /ws/rider         rider socket (phone + glasses). Auth ?token= (bearer token). The
 *                     rider's active check-in (D1) picks the TrainRoom; not riding -> 409,
 *                     the client reconnects after its next successful tap (glasses can poll
 *                     GET /api/ride/state meanwhile).
 *   /ws/kiosk/:car    kiosk socket (screen + Pi). Auth ?key= (KIOSK_KEY), ?role=screen|pi.
 *                     car -> trip (mbta/vehicles.ts) picks the TrainRoom.
 *   everything else   static assets via env.ASSETS with per-prefix SPA fallback:
 *                       /g/*      -> /g/      (glasses-web)
 *                       /kiosk/*  -> /kiosk/  (kiosk-web)
 *                       else      -> /        (phone-web, incl. the NFC landing /k/:car
 *                                              and the phone side of the games at /m)
 *                     Requests that look like files (have an extension) keep their 404,
 *                     except media kept out of git (/sounds/waiting.m4a), which comes from
 *                     the R2 bucket MEDIA when the build has no copy (routes/media.ts).
 *                     Shells are fetched as "/g/" not "/g/index.html" because the assets
 *                     layer's html_handling redirects index.html to the directory URL.
 *
 * Also exports the Durable Object classes: TrainRoom (binding TRAIN_ROOM) and GameRoom
 * (binding GAME_ROOM, the two-player game rooms behind /api/game, see routes/game.ts).
 *
 * Protocol types: CarId (kiosk path param). Socket payloads are handled in TrainRoom.
 *
 * No CORS: every client is served from this origin, and the Vite dev servers proxy /api and
 * /ws to :8787.
 */
import { Hono } from "hono";
import { z } from "zod";
import { CarId } from "@questline/protocol";
import { readConfig, type AppEnv, type Env } from "./env";
import { checkKioskKey, riderFromToken } from "./auth";
import { activeCheckin } from "./db/queries";
import { resolveCarTrip } from "./mbta/vehicles";
import { forwardToRoom, INTERNAL_HEADERS, roomFor } from "./rooms/stub";
import { authRoutes } from "./routes/auth";
import { demoRoutes } from "./routes/demo";
import { gameRoutes } from "./routes/game";
import { glassesRoutes } from "./routes/glasses";
import { passportRoutes } from "./routes/passport";
import { reportRoutes } from "./routes/report";
import { rideRoutes } from "./routes/ride";
import { tapsRoutes } from "./routes/taps";
import { usersRoutes } from "./routes/users";
import { mediaRoutes } from "./routes/media";

export { TrainRoom } from "./rooms/TrainRoom";
export { GameRoom } from "./rooms/GameRoom";

const KioskRole = z.enum(["screen", "pi"]);

const app = new Hono<AppEnv>();

// ---------- REST ----------

// Also says which flow this worker runs, so pnpm smoke checks the one that is deployed.
app.get("/api/health", (c) => {
  const cfg = readConfig(c.env);
  return c.json({ ok: true, gamesOnly: cfg.gamesOnly, demoMode: cfg.demoMode });
});
app.route("/api", authRoutes);
app.route("/api", usersRoutes);
app.route("/api", glassesRoutes);
app.route("/api", tapsRoutes);
app.route("/api", rideRoutes);
app.route("/api", passportRoutes);
app.route("/api", reportRoutes);
app.route("/api", demoRoutes);
app.route("/api", gameRoutes);
app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

// ---------- WebSockets ----------

function isUpgrade(req: Request): boolean {
  return req.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

app.get("/ws/rider", async (c) => {
  if (!isUpgrade(c.req.raw)) return c.text("expected websocket", 426);
  const userId = await riderFromToken(c.env, c.req.query("token"));
  if (!userId) return c.text("unauthorized", 401);
  const active = await activeCheckin(c.env.DB, userId);
  if (!active) return c.text("not riding", 409);
  return forwardToRoom(roomFor(c.env, active.tripId), c.req.raw, { [INTERNAL_HEADERS.user]: userId });
});

app.get("/ws/kiosk/:car", async (c) => {
  if (!isUpgrade(c.req.raw)) return c.text("expected websocket", 426);
  if (!checkKioskKey(c.env, c.req.query("key"))) return c.text("unauthorized", 401);
  const car = CarId.safeParse(c.req.param("car"));
  const role = KioskRole.safeParse(c.req.query("role") ?? "screen");
  if (!car.success || !role.success) return c.text("bad car or role", 400);
  const trip = await resolveCarTrip(c.env, car.data);
  if (!trip) return c.text("car not on a live trip", 404);
  return forwardToRoom(roomFor(c.env, trip.tripId), c.req.raw, {
    [INTERNAL_HEADERS.kioskCar]: car.data,
    [INTERNAL_HEADERS.kioskRole]: role.data,
    [INTERNAL_HEADERS.trip]: JSON.stringify(trip),
  });
});

app.all("/ws/*", (c) => c.text("not found", 404));

// ---------- static assets + SPA fallback ----------

// Not exported: named exports of the entry module are treated as Worker entrypoints.
function spaShellFor(pathname: string): "/g/" | "/kiosk/" | "/" {
  if (pathname === "/g" || pathname.startsWith("/g/")) return "/g/";
  if (pathname === "/kiosk" || pathname.startsWith("/kiosk/")) return "/kiosk/";
  return "/";
}

async function serveSpa(env: Env, req: Request): Promise<Response> {
  const res = await env.ASSETS.fetch(req);
  if (res.status !== 404) return res;
  const url = new URL(req.url);
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return res; // missing file, not a client route
  return env.ASSETS.fetch(new Request(new URL(spaShellFor(url.pathname), url), { headers: req.headers }));
}

// Media kept out of git (routes/media.ts). Only reached when the build has no such asset.
app.route("/", mediaRoutes);

app.get("*", (c) => serveSpa(c.env, c.req.raw));

// Unexpected errors: the details go to the Worker's logs (wrangler tail), never to the
// client, which only gets a request id to quote.
app.onError((err, c) => {
  const requestId = crypto.randomUUID();
  console.error(
    JSON.stringify({
      level: "error",
      requestId,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      error: err.name,
      message: err.message,
      stack: err.stack,
    }),
  );
  return c.json({ error: "Something went wrong on our side. Try again.", code: "internal", requestId }, 500);
});

export default app;
