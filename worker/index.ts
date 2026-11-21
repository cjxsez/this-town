// Questline Worker. Serves the SPA from static assets (wrangler.jsonc) and
// answers /api/*. Until the backend is wired these routes return demo data in
// the exact shapes the frontend's http client expects (src/api/http.ts).
import { Hono } from "hono";
import { INTERESTS, MISSIONS, STATIONS, badgeFor } from "../shared/catalog";
import type { Person, Profile } from "../shared/types";

type Env = {
  ASSETS: Fetcher;
  // DB: D1Database;            profiles, stamps, people, memories
  // STATION: DurableObjectNamespace;  one matching pool per station; hosts /api/ride/ws
  // MBTA_CACHE: KVNamespace;   cached live predictions
};

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true, mode: "stub" }));

app.get("/catalog", (c) => c.json({ stations: STATIONS, interests: INTERESTS, missions: MISSIONS }));

// ---- profile ----
app.get("/me", (c) => c.json<Profile | null>(null));
app.put("/me", async (c) => {
  const body = await c.req.json<Profile>();
  // TODO(backend): validate (18+, catalog ids only, first name only) and store in D1.
  return c.json(body);
});
app.delete("/me", (c) => c.body(null, 204));

// ---- people ----
app.get("/people", (c) =>
  c.json<Person[]>([
    { id: "p-dev", firstName: "Dev", badge: badgeFor(15), pronoun: "he", metAtStationId: "bu-east", metAt: new Date().toISOString(), quests: 1, stayInTouch: "connected", handles: { instagram: "dev.eats" } },
  ]),
);
// "Waiting" never turns into "declined": the response never reveals the other side's choice.
app.put("/people/:id/stay-in-touch", async (c) => {
  const { on } = await c.req.json<{ on: boolean }>();
  return c.json({ state: on ? "waiting" : "off" });
});
app.post("/people/:id/report", (c) => c.body(null, 204));
app.post("/people/:id/block", (c) => c.body(null, 204));
app.delete("/people/:id/block", (c) => c.body(null, 204));

// ---- memories ----
app.put("/memories/:id/vote", (c) => c.body(null, 204));

// ---- ride (realtime) ----
// TODO(backend): upgrade to a WebSocket on the station's Durable Object.
app.get("/ride/ws", (c) => c.text("Ride channel not wired yet; the app runs on its in-browser simulator.", 501));

app.notFound((c) => c.json({ error: "not found" }, 404));

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
