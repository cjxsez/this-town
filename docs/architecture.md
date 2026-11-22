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
| `apps/glasses-web` | Meta Ray-Ban Display browser (Web App) | 600x600 HUD: link code, idle, match card, mission, stamp. Works with zero input (we have no Neural Band); temple touch strip swipes are a bonus |
| `apps/kiosk-web` | Chromium in kiosk mode on the Pi | Shared screen in the car: idle stats, incoming pair, mission + countdown, celebration |
| `apps/kiosk-pi` | Raspberry Pi (Python) | Drives the LED strip and writes a fresh URL to the dynamic NFC tag per mission. Launches kiosk-web. |
| `packages/protocol` | Shared TS | Types + zod schemas for REST bodies and every WebSocket event. **Change the contract here first.** |
| `scripts` | Dev machine | Seed profiles, ghost riders for the demo, asset build |

No native app. The phone and glasses are both web apps served by the same Worker on one HTTPS origin.

## One origin, one Worker

```
https://<domain>/                 phone-web (SPA)
https://<domain>/k/:car?n=<nonce> phone-web NFC landing (same SPA, client route)
https://<domain>/g/               glasses-web (SPA): games at /g/, ride HUD at /g/?ride
https://<domain>/m                phone-web: the phone seat of the two-player games
https://<domain>/kiosk/:car       kiosk-web (SPA)
https://<domain>/api/*            REST (Hono); GET /api/health says {gamesOnly, demoMode}
wss://<domain>/ws/rider           rider socket (phone + glasses), auth via ?token=
wss://<domain>/ws/kiosk/:car      kiosk socket (screen + Pi agent), auth via ?key=
```

Each web app builds with Vite using its own `base` (`/`, `/g/`, `/kiosk/`). `scripts/build-assets.mjs` copies the three `dist/` folders into `apps/worker/public/` so the Worker serves them from its assets binding. The Worker handles SPA fallback per prefix (anything under `/g/` that is not a file returns `/g/index.html`, and so on).

## Identity

- **Rider:** an email address is an account. "Sign in with email" sends a 6-digit code through Cloudflare Email Sending (`POST /api/auth/email/start`, 10 min, single use, 5 wrong tries). Verifying it (`POST /api/auth/email/verify`) either signs in to the existing rider with a new bearer token, or, for a new email, returns a signup ticket; the phone onboards and `POST /api/users` redeems the ticket so the rider is created with that email. "Just play today" skips email and creates a guest (no way back in from another device). Tokens live in `localStorage` on the phone.
- **Rate limits:** every route that needs no token is capped per client IP, and sign-in emails per address too (`apps/worker/src/lib/rateLimit.ts`). Our own scripts skip the per-IP caps with the kiosk key.
- **Signed-out kiosk tap:** `/k/:car` parks the tap, sends the rider to `/signin`, and replays the tap once they are signed in (or onboarded).
- **Glasses:** the glasses have no text input. `glasses-web` calls `POST /api/glasses/code` and shows a 4-digit code. The rider types it on the phone (`POST /api/glasses/link`). The glasses poll `GET /api/glasses/code/:code` until linked, then store the same user token in their own `localStorage`.
- **Kiosk:** each kiosk has a shared secret in config (`KIOSK_KEY`). Both kiosk-web and the Pi agent connect with it.

## Location: NFC tap, not GPS or BLE

- Each kiosk tag holds `https://<domain>/k/<car>?n=<nonce>`. iPhone XS+ and Android read it in the background and show a banner that opens the link.
- **Check-in:** a tap while you have no active check-in on that car checks you in to `car` on whatever MBTA trip that car is currently running. You pick your destination stop once (or it is remembered from last time).
- **Moving cars:** tapping another car's kiosk moves your check-in.
- **Check-out:** the `TrainRoom` expires your check-in when MBTA says the train has reached your destination stop, or when you end Ride Mode.
- **Stamp proof:** during a mission the Pi rewrites the tag with a fresh nonce. A stamp needs both people in the pair to tap with the current nonce within the window. A photo of an old tag does nothing.
- **Fallback:** if the dynamic tag is not working, use a static sticker (`/k/<car>`) and accept the weaker proof.

## Sockets, reconnects and time

- The rider socket only exists after check-in (there is no `TrainRoom` before that). Before check-in, or if the socket is refused with close code `4009`, clients poll `GET /api/ride/state`, which returns a `RideSnapshot`.
- After `rider.hello` the room sends `ride.snapshot` (state + current match + mission), so a reloaded page redraws correctly.
- After `kiosk.hello` the room sends `kiosk.idle`, any active `pair.incoming` / `mission.show`, and (Pi only) `nfc.write` with the current tag URL.
- Keepalive: clients send exactly `{"type":"ping"}`; the DO auto-responds `{"type":"pong"}` without waking.
- Countdown events carry `serverNow`; clients correct for clock skew with it.
- Close codes live in `WS_CLOSE` in `packages/protocol/src/colors.ts`.
- Every rider socket action also has a REST twin (`/api/ride/not-now`, `/api/ride/arrived`) for the polling fallback.

## Car to trip mapping

MBTA V3 `vehicles` includes `carriages[]` (per-car `label`, order in the train) for the Orange Line and new Red Line cars. The Worker (`apps/worker/src/mbta/vehicles.ts`) GETs `/vehicles?filter[route]=Orange,Red&include=trip`, indexes every carriage label to a `TripInfo` for ~10 s, and resolves a tap to that trip's `TrainRoom`. `carOrder` keeps MBTA's carriage order and treats it as front-of-train first in the direction of travel (unverified against `direction_id` on a real train). No matching vehicle returns null and the tap gets the existing no-trip error.

Live stop lists come from `/predictions` (and a one-time `/schedules` seed) in `mbta/predictions.ts`, with stop ids mapped through the `packages/t-map` station catalog so they match the phone. The alarm polls while anyone is checked in; two empty polls end the trip and close kiosk sockets with `WS_CLOSE.tripChanged` so they reconnect into the new room. Live `delaySec` drives the late-train bonus the same way the demo clock does.

For the demo, `DEMO_CAR_TRIPS` in `wrangler.toml` hardcodes the mapping and a fake trip with scripted stops (`mbta/demo.ts`); that path is unchanged.

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

Ride Mode on = consent. There is no accept step. The consent is explicit: onboarding has a rules step (18+ and "Ride Mode on means I can be matched"), and every ride's first tap ends on a "Turn on Ride Mode?" screen that says what it means (D15).

1. **Pool:** riders checked in to this trip, not ghost, not in a `notNow` cooldown, not already paired, whose remaining journeys overlap by at least one more stop.
2. **Interest gate:** shared interest tags >= 1 (tunable `MIN_SHARED_TAGS`), not met in the last 7 days, not blocked either way.
3. **Rank by closeness first:** car distance (0 = same car, 1 = adjacent, ...). Ties broken by interest score (shared tags + "ask me about" similarity), then social battery match, then novelty (`1 / (1 + timesMet)` from lifetime `met_pairs`, loaded into `RoomRider.metCounts` at check-in).
4. **Pair greedily:** take the best-scoring pair overall, lock both, repeat. Everyone gets at most one partner at a time.
5. **Meeting point:** the rider with more stops left stays put and the other walks to their kiosk. On a tie, whoever checked in last stays (they just sat down; the rider already waiting walks over). Same car means nobody walks.
6. **Blurb:** Claude writes one line grounded in shared tags. Cached per pair. If the call fails or is slow (> 1.5 s), fall back to a template ("You both like ramen and books").

**No Neural Band, so the glasses need zero input.** Arrival is proven by tapping the meeting kiosk's tag (a `moveCar` into `meetAtCar`), and the mission also auto-starts `MISSION_AUTOSTART_DELAY_MS` after the match. "Not now" is a button on the phone (`POST /api/ride/not-now`): it drops you out for 10 minutes and rematches your partner. The temple touch strip can also send "I'm here" / "Not now" as a bonus once we verify its key events. Ghost mode hides you entirely.

**One pair per kiosk.** A kiosk has one tag and one screen, so it hosts at most one pair at a time. If the natural meeting kiosk is busy, use the other rider's car, or wait.

**carDelta** in `match.found` counts cars from your current car to `meetAtCar`: positive is toward the front of the train, negative toward the back. When a car is missing from the trip's `carOrder` the worker still sends `carDelta: 0` (the field stays an int). Clients must not treat that as "same car": if `carDelta === 0` and `meetAtCar` is not the rider's current car, show "Go to car \<meetAtCar\>" (glasses MatchCard and phone meet screen).

## Two-player games (`/g/` and `/m`)

Separate from the ride flow for now. The glasses open a room and show a 4-digit code, a phone joins with it, and a `GameRoom` Durable Object (one per code) owns the game state. Game rules are pure modules in `packages/protocol/src/games` (`init`, `reduce`, `tick`, `view` per seat); both clients poll every 700 ms and only draw their seat's view, so the two screens cannot drift apart. Three games play in order: Tall tale, First impressions, Left for you. Left for you keeps a short list of questions that pairs leave for the next pair, in Durable Object storage (question, answers, a timestamp and, for a matched pair, their two first names so the next pair sees who left it (D27); nothing else about them, and rooms opened by code store no names).
With `GAMES_ONLY = "true"` (D26, the demo setting) these games are all a match leads to: no mission starts, and riders' stops don't affect matching or end a pair.

Matched riders get there without a code (D25): when `TrainRoom` locks a pair it opens a game room and puts `game: { code, seat }` in each rider's `match.found`, and the phone's match and mission screens link to `/m?code=…&seat=…`.

A player who joined on a phone can move to glasses mid-game (D24): "Play on glasses" at `/m` takes the code the glasses show at `/g/` and calls `POST /api/game/rooms/:code/lens`. The seat's room records which glasses show it (`RoomView.lens`), and the room the glasses opened for themselves points at that seat (`RoomView.moved`), so the glasses poll the phone's room as that seat. The game state never moves. The phone shows a waiting screen with "Bring it back to my phone", and the game's own screen when something has to be typed.


## Missions

- Curated deck in `apps/worker/src/missions/deck.ts`. No LLM-generated missions.
- Categories: `create`, `show-me`, `spot`, `quick-game`, `late-bonus`.
- A mission must fit before the next stop minus 30 s. If not enough time, wait for the next segment.
- Late-train bonus unlocks when MBTA reports a delay over `LATE_BONUS_MIN_DELAY_S`.
- Anti-repeat: no template a user has done in their last 10, never the same template twice for a pair.

## Flow (happy path)

1. One-time: onboarding on `phone-web`, link glasses with the 4-digit code.
2. Board, tap the car's kiosk tag, pick destination, then confirm "Turn on Ride Mode" on the phone. Only that confirm sends `rideMode: true` in `POST /api/kiosk/tap`; without it the worker answers `need-destination` and nothing is turned on (D15). You are checked in, Ride Mode is on.
3. `TrainRoom` matches you. Phone and glasses get `match.found`, the kiosk gets `pair.incoming`, LEDs glow the pair color.
4. Glasses: "Maya, kiosk 1 car back, look for orange. You both love ramen."
5. At the kiosk, when the second person arrives (or after a short delay), `mission.start`: the kiosk screen shows the prompt and countdown, the glasses show a compact version.
6. The Pi writes a fresh nonce to the tag. Both tap; the tap itself is the confirmation (`stamp.progress` after the first, `stamp.awarded` after the second). Kiosk celebrates.
7. Mission ends at the next stop minus 30 s, or on stamp. You are eligible for a new match on the next segment.
8. At your destination stop, the room checks you out.

## Safety and privacy

- 18+ only, first names only, no photos anywhere.
- The kiosk screen is public: it shows colors and first names, never interests or blurbs.
- No camera, no microphone, no location tracking. The only location signal is which kiosk tag you tapped.
- Ghost mode, "Not now", block and report are always one action away.
- A report (`POST /api/report`) ends a live pair and the room never pairs those two again on
  that trip. With "block" the block also lands in the room's copy of both riders right away,
  not only at their next check-in. The reported rider only hears that their partner left
  (`match.cleared` reason `partner-left`); the reporter gets `reported`.
- Unblock (`POST /api/unblock`) lifts only your own block. A block the other rider placed on
  you stays, and matching treats a block in either direction as a hard filter.
- People (`GET /api/matches/recent`) carry the block flag and where you got your stamp, so a
  new phone shows the same list.

## Hardware (per kiosk)

Raspberry Pi 4/5, 7" touchscreen, WS2812 LED strip, dynamic NFC tag (NTAG I2C plus or ST25DV over I2C, static NTAG215 sticker as fallback), power bank, phone hotspot. Details and wiring in `docs/hardware.md`.
