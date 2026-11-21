# Questline architecture

This is the source of truth for how the pieces fit. If code and this doc disagree, fix one of them in the same PR.

## The product in one paragraph

Riders on the MBTA turn on **Ride Mode**. That is the consent: while it is on, Questline pairs you with the **closest rider on your train whose interests overlap with yours**, with no "do you accept?" step. Every train car has a **kiosk** (Raspberry Pi, touchscreen, LED strip, NFC tag). You tap the kiosk tag when you board, which tells us which car you are in. When you get matched, your **Meta Ray-Ban Display glasses** show who it is and where to go ("Maya, kiosk 1 car back, you both love ramen"), the kiosk LEDs glow your pair's color, the kiosk screen runs a short mission that ends before the next stop, and you both tap the tag again to collect a stamp.

**The phone decides who. The glasses and the kiosk make it happen.**

## Pieces

| Path | Runs on | What it does |
|---|---|---|
| `apps/worker` | Cloudflare Workers | Hono API, static asset hosting for all three web apps, D1 database, `TrainRoom` Durable Objects (one per MBTA trip) holding live state + WebSockets, matching, missions, MBTA polling, LLM "why you two" line |
| `apps/phone-web` | Rider's phone browser | Onboarding, glasses linking, Ride Mode, the NFC landing page (`/k/:car`), passport |
| `apps/glasses-web` | Meta Ray-Ban Display browser (Web App) | 600x600 HUD: link code, idle, match card, mission, stamp. Input is Neural Band arrows / Enter / Escape and temple swipe |
| `apps/kiosk-web` | Chromium in kiosk mode on the Pi | Shared screen in the car: idle stats, incoming pair, mission + countdown, celebration |
| `apps/kiosk-pi` | Raspberry Pi (Python) | Drives the LED strip and writes a fresh URL to the dynamic NFC tag per mission. Launches kiosk-web. |
| `packages/protocol` | Shared TS | Types + zod schemas for REST bodies and every WebSocket event. **Change the contract here first.** |
| `scripts` | Dev machine | Seed profiles, ghost riders for the demo, asset build |

No native app. The phone and glasses are both web apps served by the same Worker on one HTTPS origin.

## One origin, one Worker

```
https://<domain>/                 phone-web (SPA)
https://<domain>/k/:car?n=<nonce> phone-web NFC landing (same SPA, client route)
https://<domain>/g/               glasses-web (SPA)
https://<domain>/kiosk/:car       kiosk-web (SPA)
https://<domain>/api/*            REST (Hono)
wss://<domain>/ws/rider           rider socket (phone + glasses), auth via ?token=
wss://<domain>/ws/kiosk/:car      kiosk socket (screen + Pi agent), auth via ?key=
```

Each web app builds with Vite using its own `base` (`/`, `/g/`, `/kiosk/`). `scripts/build-assets.mjs` copies the three `dist/` folders into `apps/worker/public/` so the Worker serves them from its assets binding. The Worker handles SPA fallback per prefix (anything under `/g/` that is not a file returns `/g/index.html`, and so on).

## Identity

- **Rider:** onboarding creates a user and returns a bearer token, stored in `localStorage` on the phone.
- **Glasses:** the glasses have no text input. `glasses-web` calls `POST /api/glasses/code` and shows a 4-digit code. The rider types it on the phone (`POST /api/glasses/link`). The glasses poll `GET /api/glasses/code/:code` until linked, then store the same user token in their own `localStorage`.
- **Kiosk:** each kiosk has a shared secret in config (`KIOSK_KEY`). Both kiosk-web and the Pi agent connect with it.

## Location: NFC tap, not GPS or BLE

- Each kiosk tag holds `https://<domain>/k/<car>?n=<nonce>`. iPhone XS+ and Android read it in the background and show a banner that opens the link.
- **Check-in:** a tap while you have no active check-in on that car checks you in to `car` on whatever MBTA trip that car is currently running. You pick your destination stop once (or it is remembered from last time).
- **Moving cars:** tapping another car's kiosk moves your check-in.
- **Check-out:** the `TrainRoom` expires your check-in when MBTA says the train has reached your destination stop, or when you end Ride Mode.
- **Stamp proof:** during a mission the Pi rewrites the tag with a fresh nonce. A stamp needs both people in the pair to tap with the current nonce within the window. A photo of an old tag does nothing.
- **Fallback:** if the dynamic tag is not working, use a static sticker (`/k/<car>`) and accept the weaker proof.

## Car to trip mapping

MBTA V3 `vehicles` includes `carriages[]` (per-car `label`, order in the train) for the Orange Line and new Red Line cars. The Worker maps a car label to its current `trip_id`. For the demo, `DEMO_CAR_TRIPS` in `wrangler.toml` hardcodes the mapping and a fake trip with scripted stops.

## TrainRoom Durable Object

One instance per MBTA `trip_id`. Everyone on that train (riders' phones, riders' glasses, every kiosk in the train) holds a WebSocket to it, using the WebSocket Hibernation API.

It keeps in memory (and persists to DO storage on change):
- checked-in riders: `userId, car, boardedStop, destinationStop, ghost, notNowUntil`
- current pairs and their mission sessions
- current stop, next stop, ETA (from MBTA)

It runs:
- **an alarm loop** every 15 to 30 s while anyone is checked in: poll MBTA predictions/vehicle for the trip, advance stops, expire check-ins, end missions at `nextStopEta - 30s`.
- **matching** whenever the rider set changes (check-in, check-out, skip, mission ends).

D1 holds durable records (users, check-in history, matches, stamps, met pairs). The room writes to D1 on match, stamp and check-out.

## Matching

Ride Mode on = consent. There is no accept step.

1. **Pool:** riders checked in to this trip, not ghost, not in a `notNow` cooldown, not already paired, whose remaining journeys overlap by at least one more stop.
2. **Interest gate:** shared interest tags >= 1 (tunable `MIN_SHARED_TAGS`), not met in the last 7 days, not blocked either way.
3. **Rank by closeness first:** car distance (0 = same car, 1 = adjacent, ...). Ties broken by interest score (shared tags + "ask me about" similarity), then social battery match, then novelty.
4. **Pair greedily:** take the best-scoring pair overall, lock both, repeat. Everyone gets at most one partner at a time.
5. **Meeting point:** the kiosk in the car of whichever rider has more time left before their stop stays put; the other walks. Same car means nobody walks.
6. **Blurb:** Claude writes one line grounded in shared tags. Cached per pair. If the call fails or is slow (> 1.5 s), fall back to a template ("You both like ramen and books").

Escape hatches: one pinch on the glasses ("Not now") drops you out for 10 minutes and rematches your partner. Ghost mode hides you entirely.

## Missions

- Curated deck in `apps/worker/src/missions/deck.ts`. No LLM-generated missions.
- Categories: `create`, `show-me`, `spot`, `quick-game`, `late-bonus`.
- A mission must fit before the next stop minus 30 s. If not enough time, wait for the next segment.
- Late-train bonus unlocks when MBTA reports a delay over `LATE_BONUS_MIN_DELAY_S`.
- Anti-repeat: no template a user has done in their last 10, never the same template twice for a pair.

## Flow (happy path)

1. One-time: onboarding on `phone-web`, link glasses with the 4-digit code.
2. Board, tap the car's kiosk tag, pick destination. You are checked in, Ride Mode is on.
3. `TrainRoom` matches you. Phone and glasses get `match.found`, the kiosk gets `pair.incoming`, LEDs glow the pair color.
4. Glasses: "Maya, kiosk 1 car back, look for orange. You both love ramen."
5. At the kiosk, when the second person arrives (or after a short delay), `mission.start`: the kiosk screen shows the prompt and countdown, the glasses show a compact version.
6. The Pi writes a fresh nonce to the tag. Both tap and confirm on their phones. `stamp.awarded`, kiosk celebrates.
7. Mission ends at the next stop minus 30 s, or on stamp. You are eligible for a new match on the next segment.
8. At your destination stop, the room checks you out.

## Safety and privacy

- 18+ only, first names only, no photos anywhere.
- The kiosk screen is public: it shows colors and first names, never interests or blurbs.
- No camera, no microphone, no location tracking. The only location signal is which kiosk tag you tapped.
- Ghost mode, "Not now", block and report are always one action away.

## Hardware (per kiosk)

Raspberry Pi 4/5, 7" touchscreen, WS2812 LED strip, dynamic NFC tag (NTAG I2C plus or ST25DV over I2C, static NTAG215 sticker as fallback), power bank, phone hotspot. Details and wiring in `docs/hardware.md`.
