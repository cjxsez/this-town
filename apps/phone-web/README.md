# @questline/phone-web

The rider's phone app for **In This Town** (the product was called Questline; code identifiers still are). Mobile web (React 19 + Vite 8 + TypeScript, react-router 8), served by the worker at `/`.

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

The worker's happy path works on the demo trip (`pnpm smoke` checks it). For a match in http mode, run `pnpm seed && pnpm ghosts --car 1413 --auto` and onboard with an interest Maya has (ramen, film, bookstores).

Other scripts (here, or `pnpm --filter @questline/phone-web <script>`):

- `pnpm build`: typecheck, then build to `dist/`. The root `pnpm build` copies it into `apps/worker/public/`.
- `pnpm preview`, `pnpm typecheck`
- `scripts/shot.sh <url> <out.png>`: phone-size screenshot with headless Chrome.

`/screens` is a gallery of every screen with fixture data (mock mode).

## Look

Every screen follows the start screen:

- **Headings are block letters** (Bungee): `.q-title` and its sizes. Short section names use `<TileTitle>`, one letter per paper tile; the name itself is `<Wordmark>`, tiles with the T of TOWN as a green roundel. Handwriting (Gaegu) is for sentences.
- **Nothing is tilted.** Buttons, chips, cards and tickets sit level.
- **Train scenes are live 3D.** The waiting (C2), no-match (C4) and train-arriving (F3) screens show `<PlatformScene3D>`: you on the platform, the trolley coming round the bend and pulling in. On F3 it arrives as the countdown runs out. Without WebGL the old flat scene shows instead.
- **Artwork is rendered, not hand-drawn in CSS.** The files in `public/art/` come from the start screen's renderer (`pnpm art`, see `packages/start-screen/README.md`). `<ArtSlot id>` shows `public/art/<id>.webp`; `fit="contain"` is for cut-out art, the default `cover` for photos.

This app has its own `tsconfig.json` instead of extending `tsconfig.base.json`: it is on TypeScript 7 and Vite 8, and the screens were not written for `noUncheckedIndexedAccess`.

## Routes

| Path | Screen |
|---|---|
| `/`, `/:stationId` | The 3D start screen once per visit (`packages/start-screen`), then Landing (B1), or Ride Mode once a profile exists. `/:stationId` is what the platform poster's QR encodes. |
| `/start` | The start screen, every time (for demos). BEGIN goes to `/`. |
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
| `match.found` | `matched` (E1). "Never mind" / call-off -> `rider.notNow` + `cancelled` (D3) |
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

The worker runs the v2 product (kiosk check-in, no accept step, meet at a kiosk, tag-tap stamp). What the screens still need is in `docs/handoff-phone-v2.md`.

Already aligned:

- **Consent.** `match.found` goes straight to `matched`; there is no offer timer. Skip / "Not now" sends `rider.notNow`.
- **Interests, battery, rider kind.** The protocol uses this app's ids and names (decision D14), so `map.ts` passes them through.
- **Stations.** `RideState.nextStopId` and `Stamp.stationId` are catalog ids; the demo trip is Kenmore to Government Ctr.

Still bridged in `map.ts` until the screens change:

- **Badges and passwords.** The worker has pair colors, not animal badges. The animal is picked from the match id and the E3 password lines are made from the color.
- **Stamp.** The design bumps phones; the worker stamps when both tap the kiosk tag. G1 shows after your own tap.
- **No worker route yet:** photos and memories (out of scope: no camera), stay in touch, block without a report, unblock, profile edits and delete, mood change mid-ride, new prompt, passport sync (`GET /api/passport` exists, not read yet), the glasses link screen.
