# @questline/phone-web

The rider's phone app. Mobile web (React 19 + Vite 8 + TypeScript, react-router 8), served by the worker at `/`.

The screens follow the product in `docs/architecture.md` and are listed one by one in `docs/phone-flow.md`: onboarding (B1 to B7), the kiosk tap with the Ride Mode confirmation (`/k/:car`), the ride (C1 to H1), passport, people, me, glasses, and the printable kiosk sign. They talk to the backend through one seam, `src/api/types.ts` (`QuestlineApi` + `RideChannel`), which has two implementations:

| Mode | Code | What it is |
|---|---|---|
| `mock` | `src/api/mock/` | In-browser simulator that plays the server. Needs nothing else running. Adds the demo panel and seed data. Email sign-in accepts code `123456` and always treats the email as new. |
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

For a match in http mode, run `pnpm seed && pnpm ghosts --car 1413 --auto` and onboard with an interest Maya has (ramen, film, bookstores). C1's "Demo: tap the car 1412 kiosk" button stands in for a real tag (`VITE_DEMO_CAR`). In mock mode the same button and the demo panel play the whole ride.

Other scripts (here, or `pnpm --filter @questline/phone-web <script>`):

- `pnpm build`: typecheck, then build to `dist/`. The root `pnpm build` copies it into `apps/worker/public/`.
- `pnpm preview`, `pnpm typecheck`
- `scripts/shot.sh <url> <out.png>`: phone-size screenshot with headless Chrome.

`/screens` is a gallery of every screen with fixture data (mock mode).

This app has its own `tsconfig.json` instead of extending `tsconfig.base.json`: it is on TypeScript 7 and Vite 8, and the screens were not written for `noUncheckedIndexedAccess`.

## Routes

| Path | Screen |
|---|---|
| `/` | Landing (B1), or Ride Mode once a profile exists |
| `/signin`, `/signin/code` | Email sign-in S1 (email) and S2 (6-digit code). Known email: back to the parked tap or `/ride`. New email: onboarding, then an account |
| `/join/name`, `/join/interests`, `/join/about`, `/join/battery`, `/join/ride-mode`, `/join/glasses` | Onboarding B2 to B7 |
| `/k/:car?n=<nonce>` | Kiosk tag landing: pick your stop, confirm Ride Mode, or a car move / stamp tap. Signed out (worker mode): parks the tap and goes to `/signin` first |
| `/ride` | Ride Mode. One URL; the screen follows the ride phase |
| `/passport`, `/passport/:id`, `/people`, `/people/:id`, `/people/:id/report`, `/me`, `/me/glasses` | Collection and settings |
| `/print/tag/:car` | Printable "Tap here" sign for a kiosk, with a QR fallback to `/k/:car` |
| `/screens`, `/lens` | Dev: every screen with fixture data, every glasses card |

## How the worker's events reach the screens

`src/api/backend/ride.ts` turns worker events into the `ServerEvent`s of the ride reducer (`src/state/ride.ts`); `src/api/backend/map.ts` holds every conversion. `src/api/mock/rideSim.ts` emits the same events in mock mode.

| Worker | Phone |
|---|---|
| `GET /api/ride/state` (load, tab focus, socket drop), `ride.snapshot` | rebuilds the ride |
| tap result `need-destination` | `/k/:car` destination picker, then the Ride Mode confirmation |
| tap with `rideMode: true` -> `checked-in` | "Ride Mode is on", then `riding` (C2) |
| `ride.state` riding | `rideStatus` (next stop, riders on train) |
| `ride.state` off | `rideEnded` -> "Ride Mode is off" (C4) |
| `match.found` | `matched` -> meet (E1). No accept step |
| tap on the meeting kiosk, "I'm at the kiosk" | `arrived` (`rider.arrived`, REST fallback) |
| `match.cleared` before a mission | `cancelled` -> D3 ("Skipped" when it was you) |
| `mission.start` | `missionAssigned` (F1) |
| `stamp.progress`, tap result `stamp-pending` | `stampProgress` (1 of 2) |
| `stamp.awarded`, tap result `stamp-awarded` | `stampAwarded` (G2) |
| `mission.end` time-up | `missionEnded` -> recap without a stamp |
| Not now | `rider.notNow` (REST fallback) |
| Turn Ride Mode off | `POST /api/ride/end` |
| Ghost toggle, mood | `PUT /api/ride/ghost`, `POST /api/ride/mood` |
| Sign in with email | `POST /api/auth/email/start`, then `/verify`: a token (known email) or a signup ticket (new email, kept in `localStorage`) |
| Onboarding done, profile edits | `POST /api/users` once (with the signup ticket if there is one), then `PATCH /api/me` |
| Link glasses | `POST /api/glasses/link` |
| Passport, People | `GET /api/passport`, `GET /api/matches/recent` |
| Report / block | `POST /api/report` with the match id |
| Delete my data | `DELETE /api/me` |

No worker route yet: unblock (only changes this device).
