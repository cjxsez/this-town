# @questline/phone-web

The rider's phone app. Mobile web (React + Vite + TypeScript, react-router-dom v7), served by the worker at `/`.

It does four things:

1. **Onboarding**: first name, 18+, 3 to 5 interests, "ask me about", social battery, local/student/visitor. Creates the rider (`POST /api/users`) and stores the bearer token in `localStorage`.
2. **Glasses linking**: the rider types the 4-digit code shown on the lens (`POST /api/glasses/link`).
3. **Ride Mode**: live status from the rider socket (`/ws/rider?token=`): car, next stop, riders on the train, ghost mode, end ride, and when matched: partner first name, pair color, where to go, mission countdown.
4. **NFC landing** (`/k/:car?n=<nonce>`): what opens when you tap a kiosk tag. Check-in, move car, or stamp.

Plus the **passport** (stamps by line, people met) and **report/block**.

## Run

From the repo root:

```bash
pnpm install
pnpm dev:worker        # worker on :8787 (or `pnpm dev` for everything)
pnpm dev:phone         # this app on http://localhost:5173
```

Vite proxies `/api` and `/ws` (WebSockets) to `http://localhost:8787`, so the app always uses same-origin relative URLs.

Other scripts (run in this folder or with `pnpm --filter @questline/phone-web <script>`):

- `pnpm build`: typecheck, then build to `dist/`. The root `pnpm build` copies it into `apps/worker/public/`.
- `pnpm preview`: serve the build on 5173 with the same proxy.
- `pnpm typecheck`

Testing on a real phone: the dev server listens on your LAN (`host: true`). Open `http://<laptop-ip>:5173/k/1412?n=test`. For HTTPS or off-network testing, run a quick Cloudflare tunnel (`*.trycloudflare.com` is already in `allowedHosts`).

## Route map

| Path | Screen | Auth | API / events |
|---|---|---|---|
| `/onboarding?next=` | OnboardingFlow | none | `POST /api/users` |
| `/k/:car?n=<nonce>` | Tap (NFC landing) | redirects to onboarding if no token | `POST /api/taps` |
| `/` | Home (Ride Mode) | token | socket events, `PUT /api/ride/ghost`, `POST /api/ride/end`, `GET /api/me` |
| `/link` | LinkGlasses | token | `POST /api/glasses/link` |
| `/passport` | Passport | token | `GET /api/passport` |
| `/report/:matchId` | Report | token | `POST /api/report` |
| `*` | redirect to `/` | | |

The worker must return `/index.html` for all of these (SPA fallback for the `/` prefix, including `/k/*`).

## File map

```
index.html                         Entry HTML, mobile viewport (viewport-fit=cover)
vite.config.ts                     base "/", port 5173, /api + /ws proxy to :8787
tsconfig.json                      Extends tsconfig.base.json, DOM libs, react-jsx, vite/client types
src/main.tsx                       Mounts <App /> in StrictMode, loads styles.css
src/App.tsx                        Router, tab layout, RequireRider guard
src/styles.css                     CSS variables + minimal mobile-first utility classes
src/lib/auth.ts                    Token in localStorage (try/catch, in-memory fallback), onboarding redirect helpers
src/lib/api.ts                     Typed fetch wrapper, bearer token, parses responses with protocol schemas
src/lib/socket.ts                  /ws/rider?token= socket: rider.hello {client:"phone"}, ping, reconnect, ServerToRider validation
src/lib/useRide.ts                 App-wide store + hook: RideState, current match, mission, last stamp
src/routes/onboarding/types.ts     ProfileDraft + StepProps shared by the steps
src/routes/onboarding/Basics.tsx         Step 1: first name, 18+
src/routes/onboarding/Interests.tsx      Step 2: pick 3-5 InterestTag
src/routes/onboarding/AskMeAbout.tsx     Step 3: optional "ask me about" line
src/routes/onboarding/SocialBattery.tsx  Step 4: nod / quick-chat / lets-talk
src/routes/onboarding/LocalOrVisitor.tsx Step 5: local / student / visitor, Finish
src/routes/onboarding/OnboardingFlow.tsx Runs the steps, validates with Profile, POST /api/users, returns to ?next=
src/routes/LinkGlasses.tsx         4-digit lens code -> POST /api/glasses/link
src/routes/Home.tsx                Ride Mode: off / riding / matched / in-mission
src/routes/Tap.tsx                 NFC landing /k/:car?n=, handles every TapRes result
src/routes/DestinationPicker.tsx   Stop list for TapRes "need-destination"
src/routes/Passport.tsx            GET /api/passport: people met, stamps by line, stamp list
src/routes/Report.tsx              Report and/or block a match
src/components/PairColorBadge.tsx  Pair color pill using PAIR_COLOR_HEX
src/components/StampCard.tsx       One stamp
src/components/Countdown.tsx       m:ss countdown to an epoch-ms deadline
```

## How the NFC landing works

Each kiosk tag holds an NDEF URL record:

```
https://<domain>/k/<car>?n=<nonce>     dynamic tag (Pi rewrites the nonce per mission)
https://<domain>/k/<car>               static sticker fallback (no nonce, weaker stamp proof)
```

`<car>` is the MBTA carriage label printed on the car (protocol `CarId`, e.g. `1412`).

- **iPhone (XS and later)** reads NDEF tags in the background whenever the screen is on and unlocked. It shows a banner; tapping it opens the URL in the browser. No app, no permission prompt.
- **Android** reads tags when NFC is on and the screen is unlocked, and opens the URL in the default browser.
- We do **not** use Web NFC. The OS reads the tag; the page just receives a normal URL.

When `/k/:car` loads:

1. No token? Redirect to `/onboarding?next=/k/<car>?n=<nonce>`. Onboarding finishes and sends the rider straight back, so the first tap still checks them in.
2. `POST /api/taps { car, nonce }`. The worker decides what this tap means:
   - `need-destination` -> show DestinationPicker, then tap again with `destinationStop`.
   - `checked-in` -> Ride Mode is on. The app updates its state and reconnects the socket to the new trip.
   - `moved-car` -> check-in moved to this car.
   - `stamp-pending` -> you tapped during a mission, waiting on your partner.
   - `stamp-awarded` -> both tapped with the current nonce, here is your stamp.
   - `error` -> show the message.
3. The rider goes to Home (`/`) for live status.

### No universal links needed

This is a web app, so the tag URL just opens in the browser. There is no `apple-app-site-association`, no Android App Links, no app store. Things to know:

- **Storage is per browser.** The token lives in `localStorage` of whichever browser opens tag links (the default browser). Onboard in that same browser. If someone onboarded in a different browser, the tap lands on onboarding again.
- **Do not "Add to Home Screen" on iOS.** A home-screen web app has its own storage, separate from Safari, and tag links still open in Safari. That is why `index.html` does not set `apple-mobile-web-app-capable`.
- **In-app browsers** (Instagram, etc.) also have separate storage. Same fix: open in the real browser.
- A refresh of `/k/...` re-sends the tap (TODO: strip `?n=` after the tap).

## Protocol follow-ups

The gaps found while scaffolding are now in `packages/protocol` (REST types, `RideSnapshot` + `ride.snapshot` replay, `GET /api/ride/state`, `OkRes` / `ErrorRes`, `GET /api/matches/recent`, `Line` in `need-destination`, `stamp.progress`, `pong`). Still to do here:
- Import the REST types from the protocol instead of deriving them in `lib/api.ts`.
- Use `GET /api/matches/recent` so Report works after a match ends.
- Show "waiting for your partner" on `stamp-pending` / `stamp.progress`. The tap itself is the confirmation.
- Correct countdowns with `serverNow`.

