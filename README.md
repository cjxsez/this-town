# this-town · Questline

Side quests while you wait for the T. A mobile web app for BostonHacks 2026: scan the poster on the platform, get matched with one other rider, play a 2-minute spoken game before the train comes, collect the station stamp.

React 19 + Vite + TypeScript, served by a Cloudflare Worker (static assets + a Hono API under `/api/*`). The backend isn't wired yet. In the default **mock** mode, an in-browser simulator plays the server so every screen and the whole ride flow can be demoed.

## Run it

```sh
npm install
npm run dev          # http://localhost:5173, Worker + SPA together via @cloudflare/vite-plugin
npm run typecheck
npm run build        # dist/client (assets) + dist/questline (worker)
npm run deploy       # build + wrangler deploy (needs `npx wrangler login` once)
```

Open it on a phone: `npm run dev -- --host` and visit the LAN URL. It's built for 360–430px wide screens. On a desktop it renders inside a phone-sized frame.

## Find your way around

| URL | What |
| --- | --- |
| `/`, `/kenmore` | Landing page (the QR poster deep-links to `/<station>`) |
| `/join/*` | Sign-in and join, B2–B7 |
| `/ride` | Ride Mode. Renders whatever phase the ride is in (C1 → H1) |
| `/passport`, `/people`, `/memories`, `/me` | Tabs |
| `/screens` | **Dev gallery**: every wireframe screen by id, previewed from fixtures |
| `/lens` | The seven glasses lens cards |
| `/print/poster/kenmore`, `/print/badge/17` | Printable poster and badge |

The floating **D** button (mock mode only) is the demo panel. It can force a match, make the other rider say yes or drop out, trigger a delay (rare quests), a dead spot, or the train arriving, and toggle glasses. Autoplay is on by default: about 9 s after checking in an offer arrives, and the other rider accepts.

## Layout

```
shared/           types + catalog shared by app and worker (stations, interests, missions, badges)
worker/index.ts   Hono API stubs, same shapes as src/api/http.ts expects
src/api/          the backend seam: types.ts (interface), mock/ (simulator), http.ts (real client)
src/state/        ride.ts (state machine), store.tsx (app state + actions), seed.ts (demo history)
src/ui/           UI kit lifted from the hi-fi design (Screen, Button, Card, Chip, Toggle, …)
src/screens/      one file per wireframe screen, grouped by section
src/fx/           hand-drawn SVG filters, "boil", time-of-day palettes
public/art/       drop illustration files here to replace the dashed placeholders (see README there)
```

## Wiring the backend

1. Set `VITE_API_MODE=http` (e.g. in `.env.production`). The app then uses `src/api/http.ts`: REST under `/api` and one WebSocket per ride at `/api/ride/ws`.
2. Implement the routes in `worker/index.ts`. The suggested Cloudflare pieces are already commented in `wrangler.jsonc`:
   - **D1** for profiles, stamps, people and memories
   - a **Durable Object per station** as the matching pool. It holds the WebSocket connections, runs the one-best-match scoring, and owns the offer, bump and photo timers. It speaks the `ServerEvent` protocol in `src/state/ride.ts`, and commands arrive as `{cmd, ...args}` (see `RideChannel` in `src/api/types.ts`).
   - **KV** to cache MBTA predictions
3. `RideSim` in `src/api/mock/rideSim.ts` is the executable spec for the server's behaviour: timings, one offer at a time, skip = timeout = cancel, the 20 s bump window, and stamps held when someone boards.
