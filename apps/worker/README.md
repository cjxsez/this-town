# @questline/worker

The Cloudflare Worker behind Questline. One deploy, one HTTPS origin:

- **Hono REST API** under `/api/*` (onboarding, glasses linking, NFC taps, Ride Mode, passport, report).
- **Static hosting** for phone-web (`/`), glasses-web (`/g/`) and kiosk-web (`/kiosk/`) from `public/` via the `ASSETS` binding.
- **D1** (`DB`) for durable records: users, sessions, glasses codes, check-ins, matches, mission sessions, stamps, met pairs, blocks, reports.
- **`TrainRoom` Durable Objects** (`TRAIN_ROOM`), one per MBTA trip: live rider state, every phone/glasses/kiosk WebSocket on that train (Hibernation API), an alarm loop that polls MBTA, matching, missions and stamps.
- **`GameRoom` Durable Objects** (`GAME_ROOM`), one per 4-digit game code: the two-player games between a pair of glasses (`/g/`) and a phone (`/m`). It runs the pure game modules from `packages/protocol/src/games`, clients poll it (no sockets, no alarms), and timers are server-time deadlines. No login: the code is the only key. One extra instance holds values shared between rooms (the trivia questions pairs leave for each other).
- **MBTA V3** polling (car label to trip via `carriages`, predictions for next stop and delay), with a scripted demo trip when `DEMO_MODE=true`.
- **Claude** for the one-line "why you two" (1.5 s timeout, template fallback) and for the three wrong answers to a trivia question a pair leaves in "Left for you" (6 s timeout; without a key or on a bad reply the question is not saved). Missions never come from the LLM.

Contract: `packages/protocol`. Architecture: `docs/architecture.md`.

## Status

The happy path works on the demo trip and is covered by `pnpm smoke` (see "Run locally"):

- onboarding (`POST /api/users`, `GET /api/me`) and the 4-digit glasses link with a poll secret
- check-in from a kiosk tap: destination picker, then `rideMode: true` is required to turn Ride Mode on (D15); moving cars, ending the ride, ghost mode, mood (`POST /api/ride/mood`)
- profile edits and delete: `PATCH /api/me`, `DELETE /api/me` (checks out, then scrubs the rider; partners' stamps say "Someone")
- People: `GET /api/matches/recent`
- matching with no accept step: same trip, shared interests, closest car first, one pair per kiosk
- arrival (tap on the meeting kiosk, `rider.arrived`, `POST /api/ride/arrived`, or 20 s autostart)
- missions from the deck that fit before the next stop, late-train bonus after a delay
- two-tap stamp with a fresh nonce on dynamic tags, celebration, passport
- "Not now" (socket or `POST /api/ride/not-now`), report, check-out at the destination stop
- demo controls: `POST /api/demo/delay | advance | reset` (header `x-kiosk-key`)

Not done yet:

- **Live MBTA.** `resolveLiveCarTrip` and live predictions are still stubs, so only cars in `DEMO_CAR_TRIPS` work. Fine for the demo.
- Block/unblock without a report.

## File map

```
wrangler.toml                 bindings (ASSETS, DB, TRAIN_ROOM), DO migration, [vars]
.dev.vars.example             secrets to copy into .dev.vars
migrations/0001_init.sql      D1 schema (all tables)
src/index.ts                  Hono app: mounts /api routes, /ws upgrades -> TrainRoom, SPA fallback; exports TrainRoom
src/env.ts                    Env bindings type, AppEnv for Hono, readConfig() for [vars]
src/auth.ts                   bearer token middleware (rider), kiosk key check
src/nfc.ts                    mission nonces and tag URLs (${PUBLIC_ORIGIN}/k/<car>?n=<nonce>)
src/routes/users.ts           POST /api/users, GET /api/me
src/routes/glasses.ts         POST /api/glasses/code, GET /api/glasses/code/:code, POST /api/glasses/link
src/routes/taps.ts            POST /api/taps: check-in, move car, stamp confirm, need-destination
src/routes/ride.ts            POST /api/ride/end, PUT /api/ride/ghost, GET /api/ride/state (glasses polling)
src/routes/passport.ts        GET /api/passport
src/routes/report.ts          POST /api/report (+ block)
src/routes/game.ts            POST /api/game/rooms, POST /api/game/rooms/:code/join, GET /api/game/rooms/:code?seat=, POST /api/game/rooms/:code/act
src/rooms/GameRoom.ts         the game room Durable Object: seats, presence, playlist, runs the game modules
src/games/hooks.ts            async work a game needs (LLM, shared store), fed back as "server" actions
src/games/trivia.ts           Left for you: picks the questions for a room, saves the one a pair leaves
src/llm/decoys.ts             wrong answers for a left question, and whether it can be kept
src/routes/demo.ts            POST /api/demo/delay|advance|reset (DEMO_MODE + kiosk key only)
src/rooms/TrainRoom.ts        the Durable Object: sockets, alarm loop, check-in/out, matching, missions, stamps
src/rooms/state.ts            RoomState and related types, socket attachments/tags
src/rooms/stub.ts             roomFor(tripId), forwardToRoom() with internal identity headers
src/matching/pool.ts          hard filters: who is matchable, which pairs are allowed
src/matching/score.ts         car distance, interest score, battery match, novelty, sort order
src/matching/pair.ts          greedy pairing, meeting point (who walks), carDelta
src/matching/colors.ts        pair colors not already in use on this train
src/missions/deck.ts          the curated mission deck
src/missions/select.ts        fit-before-next-stop, late bonus, anti-repeat, rarity
src/missions/fill.ts          {slot} filling and Mission construction
src/mbta/client.ts            MBTA V3 fetch wrapper (x-api-key)
src/mbta/predictions.ts       trip -> stops, next stop, ETA, delay
src/mbta/vehicles.ts          car label -> current trip (carriages), demo override
src/mbta/demo.ts              scripted demo trip (Orange, cars 1413/1412), triggerable delay
src/llm/why.ts                Claude "why you two" line, 1.5 s timeout, template fallback
src/db/queries.ts             typed D1 helpers (all SQL lives here)
src/lib/ids.ts                ids, tokens, sha256, 4-digit codes, pairKey
src/lib/time.ts               time constants and helpers
src/lib/http.ts               JSON body parsing with protocol zod schemas
src/lib/api.ts                inferred REST types + worker-local response shapes
```

## Run locally

From the repo root:

```bash
pnpm install
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # fill in keys
mkdir -p apps/worker/public                               # or `pnpm build` to fill it
pnpm db:migrate:local                                     # applies migrations/ to local D1
pnpm dev:worker                                           # wrangler dev on :8787
pnpm smoke                                                # in another terminal: end-to-end check
```

`pnpm smoke` (`scripts/smoke.ts`) plays two riders, a pair of glasses and the car 1413 kiosk through onboarding, glasses link, check-in, match, mission and stamp, then "Not now", the late-train bonus and check-out at a stop. It needs `KIOSK_KEY` in `.dev.vars` and resets the demo trip first.

`wrangler dev` needs `public/` to exist. It is gitignored and filled by `pnpm build` (root), which builds the three web apps and copies their `dist/` folders in. During development the web apps run on their own Vite servers and should proxy `/api` and `/ws` to `http://localhost:8787`.

Override any `[vars]` in `.dev.vars`. Set `PUBLIC_ORIGIN` to an address your phone can open (it goes into NFC tag URLs).

## Create the D1 database

```bash
cd apps/worker
npx wrangler d1 create questline        # paste the printed database_id into wrangler.toml
pnpm db:migrate:remote                  # wrangler d1 migrations apply questline --remote
```

New schema changes go in a new file `migrations/000N_<name>.sql`. Never edit an applied migration.

## Secrets

```bash
cd apps/worker
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put MBTA_API_KEY
npx wrangler secret put KIOSK_KEY
```

## Deploy

```bash
pnpm run deploy        # root: builds the web apps into apps/worker/public, then wrangler deploy
```

Set `PUBLIC_ORIGIN` in `wrangler.toml` to the real domain first, and set `DEMO_MODE = "false"` for anything but the demo.

## Routing and SPA fallback

`wrangler.toml` `[assets]` uses `run_worker_first = ["/api/*", "/ws/*", "/g/*", "/kiosk/*", "/k/*"]`, so those paths always reach the Worker. Other paths are served straight from `public/` when a file matches, and fall through to the Worker when nothing matches. `not_found_handling` stays at its default so a miss is a real 404 the Worker can see.

In `src/index.ts`:

1. `/api/*` goes to the Hono routes. Unknown API paths return JSON 404.
2. `/ws/rider` and `/ws/kiosk/:car` are authenticated in the Worker, then forwarded to the right `TrainRoom` stub with internal headers (`x-questline-*`, always stripped from the client request first).
3. Everything else: try `env.ASSETS.fetch(request)`. On 404, if the path has no file extension, serve the SPA shell for its prefix: `/g/` for `/g/*`, `/kiosk/` for `/kiosk/*`, `/` for everything else (including `/k/:car`, the phone-web NFC landing route).

## Which TrainRoom?

- A tap names a car. `mbta/vehicles.ts` maps it to a trip (demo: `DEMO_CAR_TRIPS`), and the room is `idFromName(tripId)`.
- A rider socket or `/api/ride/*` call uses the rider's open check-in row in D1 (`checkins.checked_out_at IS NULL`).
- A kiosk socket resolves its car to a trip on connect. When the trip ends the room closes kiosk sockets (code 4002) so they reconnect to the car's next trip.

## Migrations

- `0001_init.sql`: the original schema.
- `0002_phone_vocab.sql`: the phone's vocabulary (decision D14). Rebuilds `users` with the new `social_battery` / `status` values, adds `stamps.station_id` and `glasses_codes.poll_secret_hash`. Users created before it have old interest tags and won't load; recreate test users.
