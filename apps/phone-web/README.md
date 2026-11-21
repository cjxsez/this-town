# @questline/phone-web

The rider's phone app. Mobile web (React 19 + Vite 8 + TypeScript, react-router 8), served by the worker at `/`.

The screens are the "Questline screens v2" design: onboarding (B1 to B7), Ride Mode (C1 to H1), passport, people, memories, me, glasses, and the printable poster and badge. They talk to the backend through one seam, `src/api/types.ts` (`QuestlineApi` + `RideChannel`), which has two implementations:

| Mode | Code | What it is |
|---|---|---|
| `mock` | `src/api/mock/` | In-browser simulator that plays the server. Needs nothing else running. Adds the demo panel and seed data. |
| `http` | `src/api/backend/` | The real worker in `apps/worker`: REST (`src/lib/api.ts`), the rider socket (`src/lib/socket.ts`), bearer token (`src/lib/auth.ts`). |

`VITE_API_MODE` picks one. Unset, `pnpm dev` uses `mock` and a production build uses `http`.

## Run

From the repo root:

```bash
pnpm install
pnpm dev:phone         # http://localhost:5173, simulator
```

Against the worker:

```bash
cp apps/phone-web/.env.example apps/phone-web/.env.local   # VITE_API_MODE=http, VITE_DEMO_CAR=1412
pnpm db:migrate:local
pnpm dev:worker        # :8787
pnpm dev:phone
```

Vite proxies `/api` and `/ws` to `http://localhost:8787`, so the app always uses same-origin relative URLs.

**The worker is still a scaffold.** Every query in `apps/worker/src/db/queries.ts` and most of `TrainRoom` throw `TODO`, so today `GET /api/health` answers and everything else returns 500. In `http` mode onboarding completes on the phone but the rider is not created, and a tap shows "That tap didn't take". The adapter is written against `packages/protocol` and has not run against a live worker yet.

Other scripts (here, or `pnpm --filter @questline/phone-web <script>`):

- `pnpm build`: typecheck, then build to `dist/`. The root `pnpm build` copies it into `apps/worker/public/`.
- `pnpm preview`, `pnpm typecheck`
- `scripts/shot.sh <url> <out.png>`: phone-size screenshot with headless Chrome.

`/screens` is a gallery of every screen with fixture data (mock mode).

This app has its own `tsconfig.json` instead of extending `tsconfig.base.json`: it is on TypeScript 7 and Vite 8, and the screens were not written for `noUncheckedIndexedAccess`.

## Routes

| Path | Screen |
|---|---|
| `/`, `/:stationId` | Landing (B1), or Ride Mode once a profile exists. `/:stationId` is what the platform poster's QR encodes. |
| `/join/*` | Onboarding B2 to B7 |
| `/ride` | Ride Mode. One URL; the screen follows the ride phase. |
| `/k/:car?n=<nonce>` | Kiosk tag landing (`http` mode): `POST /api/taps`, destination picker, then `/ride` |
| `/passport`, `/people`, `/memories`, `/me` | Collection and settings |
| `/print/poster/:stationId`, `/print/badge/:number` | Printables |

## How the worker's events reach the screens

`src/api/backend/ride.ts` turns worker events into the `ServerEvent`s of the ride reducer (`src/state/ride.ts`); `src/api/backend/map.ts` holds every conversion.

| Worker | Phone |
|---|---|
| `GET /api/ride/state` (load, tab focus, socket drop), `ride.snapshot` | rebuilds the ride |
| `ride.state` riding | `checkedIn` the first time, then `trainEta` (next stop ETA) |
| `ride.state` off | `trainDeparted`, socket closed |
| `match.found` | `offer` (D1). Yes -> `matched` (E1). Skip, "never mind", or 60 s unanswered -> `rider.notNow` + `cancelled` (D3) |
| `match.cleared` | `cancelled` before a mission started, `ended` (recap) after |
| `mission.start` | `matched` if not yet, then `missionAssigned` (F1) |
| `mission.end` time-up / cancelled | `ended` |
| `stamp.progress` | `partnerBumped` |
| `stamp.awarded`, tap result `stamp-awarded` | `stampAwarded` (G2) |
| "I'm here" (E1), "Start" (E3) | `rider.arrived` (socket, REST fallback) |
| Ride Mode off | `POST /api/ride/end` |
| Ghost toggle | `PUT /api/ride/ghost` |
| Report | `POST /api/report` with the match id |
| Onboarding done | `POST /api/users` once; token in `localStorage` |

## Frontend and worker differences

The design and the worker were built from different versions of the product. The adapter bridges what it can; these need a product decision.

- **Where it happens.** The design is on the platform (scan a station QR, pick line and direction on C1, countdown to the train). The worker is on the train (tap the kiosk tag in your car, countdown to the next stop). In `http` mode C1's toggle only works with `VITE_DEMO_CAR`, which taps that car and rides to the last stop; real check-in is the kiosk tag.
- **Consent.** The worker has no accept step (`docs/decisions.md`: Ride Mode is the consent). The design asks Yes / Skip. Yes stays on the phone; Skip sends "Not now". The other rider and the kiosk already see the match before Yes.
- **Badges and passwords.** The worker has pair colors, not animal badges. The partner's color is real; the animal is picked from the match id, and the E3 password lines are made from the color.
- **Stamp.** The design bumps phones; the worker stamps when both tap the kiosk tag. G1 shows after your own tap.
- **Interests.** The design has 34 Boston-flavoured interests, the worker 25 tags and needs 3 to 5. `map.ts` folds one into the other and pads to three.
- **Station names.** The worker sends stop names; the screens key art and stamps by catalog id. Unknown stops get a slug id and default art.
- **No worker route yet:** photos and memories, stay in touch, block without a report, unblock, profile edits and delete, mood change mid-ride, new prompt, passport sync (`GET /api/passport` is not read; stamps live in `localStorage`), the 4-digit glasses link (`api.linkGlasses` exists, the Glasses screen still simulates).
- **In `packages/protocol` but not routed by the worker yet:** `POST /api/ride/not-now` and `/arrived` (the adapter falls back to them when the socket is down).
