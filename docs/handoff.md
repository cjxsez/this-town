# Handoff: what is left to build

Written 2026-11-22 for whoever (person or agent) picks up the remaining work. Every item says
what to change, where, and how to know it's done. Items are in priority order: finish a
section before starting the next.

## Read before touching anything

1. `CLAUDE.md` (repo rules), `docs/architecture.md` (source of truth), `docs/decisions.md`.
2. `packages/protocol/src/` is the contract. **If a REST body or socket event changes, change
   the protocol first**, then the worker and every client in the same commit. Kiosk event
   changes are mirrored in `apps/kiosk-pi/protocol.md` and `apps/kiosk-pi/questline_kiosk/protocol.py`.
3. Hard rules that must not be broken:
   - No native app, no camera, no mic, no BLE, no GPS. Location only comes from NFC taps.
   - The kiosk screen is public: first names and colors only, never interests or blurbs.
   - Missions come from the curated deck (`apps/worker/src/missions/deck.ts`), never from the LLM.
   - Keep each app's README current with how to run it.
4. Several TODO comments in the code are **out of date**. Check before "fixing" them:
   - `RideSnapshot` already carries `match` and `mission` (`packages/protocol/src/models.ts`),
     so "reloading mid-match loses the card" in `apps/glasses-web/src/App.tsx` is likely
     already handled. Verify, then delete the TODO.
   - REST twins for socket actions already exist: `POST /api/ride/not-now`,
     `POST /api/ride/arrived` (`apps/worker/src/routes/ride.ts`). The glasses socket TODO
     saying "there are no REST routes" is stale; use them (task 3.2).
   - Close codes are already defined in `WS_CLOSE` (`packages/protocol/src/colors.ts`).

## How to work

- Node 22, pnpm. Python 3.11 for `apps/kiosk-pi`.
- Commit each logical change on its own, with a message that says what the user or operator
  now gets ("Kiosk LEDs pulse in the pair colour during a mission"), not "update file".
  Small, real commits. Do not split one change across commits or make empty/no-op commits to
  raise the count.
- Before every push: `git pull --rebase origin main`, then
  `pnpm -r --if-present typecheck` and `pnpm build` must pass. For kiosk-pi: `pytest` in
  `apps/kiosk-pi`. Teammates push to `main` too, so rebase often and never force-push.
- Remove a TODO comment in the same commit that resolves it.
- When a decision changes (anything in `docs/decisions.md`), add a row there.

Useful commands:

```
pnpm install
pnpm db:migrate:local
pnpm dev                 # worker :8787 + phone :5173 + glasses + kiosk
pnpm smoke               # end-to-end happy path against a running worker
pnpm seed && pnpm ghosts # demo data
cd apps/kiosk-pi && python -m questline_kiosk --fake   # Pi agent with fake LEDs and tag
```

---

## 1. Kiosk Pi agent (`apps/kiosk-pi`), highest priority

**Status (2026-11-22):** Shipped in software — socket loop with close-code handling, LED
animations + FakeLeds mapping tests, lazy real LED drivers, dynamic NFC writers + FakeTag /
fake SMBus tests, browser launcher crash-flag clear, README/hardware docs, and a local
websockets integration test (hello → nfc.written → 4002 reconnect → 1001 shutdown). Still
needs a real Pi with LEDs + NFC board (or static stickers) for demo steps 3 and 5.
Contract: `apps/kiosk-pi/protocol.md`.

### 1.1 Socket loop (`questline_kiosk/agent.py`)
- Implement `KioskAgent.connect` / `run`: connect to
  `wss://<domain>/ws/kiosk/<car>?key=<kiosk_key>&role=pi` with the `websockets` library
  (`websockets.asyncio.client.connect`), `ws://` when `tls = false`.
- On every connect send `kiosk.hello` with `car`, `role: "pi"`, and `hw: { leds, nfc }` from config.
- Ping task: every `agent.ping_interval_s` send exactly `{"type":"ping"}`. Ignore `pong`.
- Reconnect forever with `backoff_delays(reconnect_min_s, reconnect_max_s)` (already written).
  Reset the backoff after a connection has stayed up for 30 s.
- Close codes: on `4001` (bad key) or `4003` (forbidden) log an error and stop retrying fast
  (sleep `reconnect_max_s`); on `4002` (trip changed) reconnect immediately.
- On shutdown (SIGINT/SIGTERM) close with code 1001 and clear the LEDs.
- Dispatch each parsed event (parser exists in `protocol.py`) to the LED and tag handlers below.
  Unknown types are ignored; known types with bad fields are logged and dropped.
- While disconnected, show the offline LED state (`_show_offline`).
- Done when: with `pnpm dev` running and `config.toml` pointing at `localhost:8787`,
  `python -m questline_kiosk --fake` logs hello, receives `kiosk.idle`, survives killing and
  restarting the worker, and reacts to a match made with `pnpm ghosts`.

### 1.2 LED behaviour (`agent.py` handlers + `animations.py`)
- Implement `idle`, `pulse`, `burst`, `rainbow` in `animations.py` (each is an `async` loop
  over a `LedStrip`, cancelled by `AnimationPlayer`; docstrings describe the envelopes).
- Mapping (from `protocol.md`):
  - `kiosk.idle`: dim idle animation in `idle_color`, only if no pair is active (it is a
    stats push, not a reset).
  - `pair.incoming`: solid pair color (`PAIR_COLOR_HEX`).
  - `mission.show`: slow pulse in the pair color.
  - `stamp.progress` with `tapped: 1`: one short white flash, then back to the pulse.
  - `celebrate`: burst in the pair color for `celebrate_s`; if `rare`, burst then rainbow.
    Then hold the pair color.
  - `pair.cleared`: back to idle, only if `matchId` is the pair being shown.
- Track the active `matchId` so stale events for an old pair are ignored.
- Done when: `python scripts/led_test.py --fake` previews every animation, and the agent
  in `--fake` mode prints the right colors through a full ghost-rider match.
- Add pytest tests for the event-to-animation mapping using `FakeLeds`.

### 1.3 Real LED drivers (`leds.py`)
- `Ws281xStrip`: `rpi_ws281x.PixelStrip(count, pin, brightness=int(b*255), strip_type=GRB)`,
  `begin()`, `setPixelColor`, `show`, `setBrightness`. Pi 4, GPIO18, needs root.
- `NeopixelSpiStrip`: `neopixel_spi.NeoPixel_SPI(board.SPI(), count, brightness=b,
  auto_write=False, pixel_order=GRB)`. Pi 5 or Pi 4 without root, data on GPIO10.
- Import the hardware libraries lazily inside `__init__` so laptops without them still work.
- Respect `brightness` as a current cap (30 LEDs at full white is ~1.8 A).

### 1.4 Dynamic NFC tag writers (`nfc_tag.py`)
- `DynamicNtagI2C` (NXP NT3H2111/2211, I2C 0x55) via `smbus2`: write the payload from
  `build_tag_payload(url, block_size=16)` starting at block 1 (user memory), 16-byte blocks,
  each write followed by a short wait (~5 ms) for EEPROM; then read it back and compare.
  Retry `write_retries` times, raise `NfcTagError` on failure.
- `DynamicSt25dv` (user memory at 0x53): 2-byte memory address writes, page size 4 (04K) or
  as the docstring says; same read-back verify.
- In the agent: on `nfc.write` (only when `nfc.mode == "dynamic"`) run the blocking write in
  `asyncio.to_thread`, then send `nfc.written {writeId, url}` or `nfc.failed {writeId, reason}`.
- Add pytest tests with a fake `SMBus` that records writes, checking block layout and retries.

### 1.5 Browser launcher (`browser.py`)
- `wait_for_display`: poll for the X/Wayland display socket (`$WAYLAND_DISPLAY` or `/tmp/.X11-unix/X0`) up to the timeout.
- Before launching, clear Chromium's crash flags in
  `<user-data-dir>/Default/Preferences` (`exited_cleanly: true`, `exit_type: "Normal"`) so
  no "restore pages" bubble appears.

### 1.6 Docs
- Update `apps/kiosk-pi/README.md` status line once 1.1 to 1.4 work.
- Keep `docs/hardware.md` pre-event checklist in step with what was actually tested.

---

## 2. Live MBTA trips (`apps/worker/src/mbta`)

**Status (2026-11-22):** Shipped — `resolveLiveCarTrip` / `parseVehicles` (10 s cache),
`fetchTripTimeline` / `parseTimeline`, TrainRoom empty-poll trip end + `WS_CLOSE.tripChanged`,
fixture unit tests. Demo mode still preferred for rehearsals. Still needs a live Orange/Red
car label with `DEMO_MODE=false` + `MBTA_API_KEY` to confirm on the real line.

- `vehicles.ts` `resolveLiveCarTrip()`: `GET /vehicles?filter[route]=Orange,Red&include=trip`,
  find the vehicle whose `carriages[].label` contains the car, return `TripInfo`. Cache the
  label-to-trip index for ~10 s. Normalize car order so the front of the train is first.
- `predictions.ts` `fetchTripTimeline()`: as described in its header comment (stops by
  `stop_sequence`, next stop, ETA, delay from the schedule include). Drop SKIPPED/CANCELLED
  stops; merge with the previous stop list so indexes stay stable.
- `TrainRoom.alarm()`: when the room is not a demo trip, poll the timeline every ~20 s while
  anyone is checked in; treat two empty polls in a row as trip ended (close kiosk sockets
  with `WS_CLOSE.tripChanged` so they reconnect into the new trip's room).
- Late bonus: use the live `delaySec` against `LATE_BONUS_MIN_DELAY_S`.
- Add unit tests for the JSON:API mapping with recorded MBTA fixtures (no network in tests).
- Done when: with `DEMO_MODE = "false"` locally and a real Orange Line car label, a tap
  resolves a trip and the phone shows real next-stop ETAs.

---

## 3. Glasses web app (`apps/glasses-web`)

**Status (2026-11-22):** Shipped — wake lock, ErrorBoundary, WS_CLOSE + REST send fallback,
visibility pause, server clock, snapshot restore, stamp progress / stamped timeout, linking
429 + "Linked as", pure `src/state.ts` + tsx tests, unknown-`carOrder` "Go to car" copy.
Still needs on-device checks: WebSockets vs polling, Escape/back (hidden unlink skipped until
then), type size / color on the waveguide.

### 3.1 Staying alive
- Screen Wake Lock: request `navigator.wakeLock.request("screen")` when a ride starts and
  re-request on `visibilitychange`; no-op if unsupported.
- Global error boundary in `main.tsx`: a plain 600x600 black screen "Something broke. Swipe
  to reload." that reloads on any key.
- Pause polling and sockets on `visibilitychange` hidden; resume on visible.

### 3.2 Polling fallback (`lib/socket.ts`)
- In polling mode `send()` currently returns false. Map `rider.arrived` to
  `POST /api/ride/arrived` and `rider.notNow` to `POST /api/ride/not-now` (both exist).
- Show a small "Couldn't send" line if a send fails, instead of silently dropping it.
- While polling, retry the WebSocket every ~3 minutes.
- Use `WS_CLOSE` from the protocol: stop reconnecting on `badAuth` / `forbidden` and clear the token on `badAuth`.

### 3.3 Correctness
- Clock offset: store `serverNow - Date.now()` from `ride.snapshot` / countdown events and use
  it in `components/Countdown.tsx` so the lens, phone and kiosk agree.
- `mission.end` "stamped" with no `stamp.awarded` within ~5 s: fall back to Idle.
- Mission screen: show "1 of 2 tapped" on `stamp.progress`.
- Confirm the reload-mid-match case works from `ride.snapshot` (see stale TODOs above) and delete the TODO.

### 3.4 Linking (`lib/link.ts`, `screens/LinkCode.tsx`)
- Handle an expired/unknown code (check what `GET /api/glasses/code/:code` returns in
  `apps/worker/src/routes/glasses.ts`) by fetching a fresh code.
- Back off polling on 429.
- After linking, show "Linked as <firstName>" for 2 s (`GET /api/me` with the new token).
- Hidden unlink: hold back on Idle for 3 s clears the token. Only if on-device testing shows
  Escape reaches the page (see `lib/input.ts`); otherwise skip and note it.

---

## 4. Phone web app (`apps/phone-web`)

**Status (2026-11-22):** Shipped — worker errors parsed as `ErrorRes` (with `code` and
`issues`), 8 s request timeout, one retry for reads only, any 401 on a signed-in request
drops the token and profile, socket stops after `checkedOut` / `noRide` / `forbidden`
(a bad token is an HTTP 401 at the handshake, caught by the REST re-sync), Sign out on Me
with a guest warning. Also: People keep blocks and the meeting station across phones, and
Unblock reaches the worker (`POST /api/unblock`). 33 tests in `apps/phone-web/test`. Mock
mode unchanged.

- `lib/api.ts`: request timeout with `AbortController` (8 s default), one retry for GETs.
- Global 401: clear the token and route to `/` (sign-in), so a stale token after a DB reset
  never leaves the app stuck. `api/backend/ride.ts` already handles it for one call; make it global.
- Agree on one error body with the worker: add `ErrorRes { error: string, code?: string }` to
  `packages/protocol`, return it from every worker route's error path, and show `error` in
  the phone's toasts.
- `lib/socket.ts`: stop reconnecting on `WS_CLOSE.badAuth` / `forbidden`; on `noRide` fall back
  to polling `GET /api/ride/state` (check what `api/backend/ride.ts` already does first).
- "Sign out" on Me (clears the token, keeps nothing local). "Delete my data" already calls
  `DELETE /api/me`; check it also signs out locally.
- Mock simulator (`src/api/mock/rideSim.ts`) must keep working: `pnpm dev` defaults to mock mode.

---

## 5. Kiosk screen (`apps/kiosk-web`)

**Status (2026-11-22):** Shipped — server clock, key strip from URL, How it works overlay,
one-pair replace / stale clear, ErrorBoundary + 5 min offline reload, WS_CLOSE reject /
tripChanged, pure `src/state.ts` + tsx tests. Still needs a Pi Chromium session against a
deployed worker for the unattended path.

- Clock offset from `serverNow` in `App.tsx` and `components/Countdown.tsx` (same as 3.3).
- `lib/config.ts`: after saving `?key=` to storage, strip it from the URL with `history.replaceState`.
- `screens/Idle.tsx`: touch anywhere shows a 10 s "How it works" overlay (three steps: tap
  in, get matched, meet here and tap for a stamp). Public screen: no names or interests.
- Two pairs at one kiosk: the worker allows one pair per kiosk, so just make sure a second
  `pair.incoming` for a different `matchId` replaces the first cleanly and `pair.cleared` for
  the old one doesn't blank the new one. Add a comment saying why there is no split screen.

---

## 6. Ops and setup (people, not code)

- Move `husshusshuss.boston` DNS from Porkbun to Cloudflare, then
  `wrangler email sending enable husshusshuss.boston`. Until then sign-in emails are only
  simulated; use "Just play today" on the live site.
- Decide: dynamic NFC board (NTAG I2C plus / ST25DV) this weekend, or static stickers.
- On real glasses: confirm WebSockets work and whether Escape/back closes the Web App.
  Record the answers in `docs/decisions.md` "Still open".
- Deploy: `pnpm build && pnpm run deploy` after merging; `pnpm smoke` against the deployed URL.

---

## 7. Tests and CI (do alongside, not last)

**Status (2026-11-22):** Shipped — `.github/workflows/ci.yml` (typecheck, build, `pnpm test`,
kiosk-pi pytest) on every push and PR. `pnpm test` runs node:test via tsx in protocol (the
three games), worker (matching, missions, live MBTA parsers), phone, glasses, kiosk, t-map
and start-screen; the worker uses pure-function tests rather than vitest-pool-workers.
`pnpm smoke` reads `GET /api/health` and checks whichever flow the worker runs (games-only
by default, D26; missions with `--var GAMES_ONLY:false`), and now covers People
block/unblock and a report mid-match. Not covered: the Durable Objects themselves (only
through `pnpm smoke`), and anything on real glasses or a real Pi.

- There is no CI. Add `.github/workflows/ci.yml`: pnpm install, `pnpm -r --if-present typecheck`,
  `pnpm build`, `pnpm -r --if-present test`, and `pytest` in `apps/kiosk-pi`.
- Worker unit tests (vitest + `@cloudflare/vitest-pool-workers`) for matching
  (`src/matching/*`), mission selection (`src/missions/select.ts`) and the MBTA mapping.
- Protocol game modules (`packages/protocol/src/games`): tests for `reduce`/`tick` of each game.

## Definition of done for the whole handoff

- `pnpm smoke` passes against a local worker and against the deployed one.
- The demo script (`docs/demo-script.md`) runs end to end with one real kiosk (LEDs + dynamic
  tag) or with the static-sticker fallback, and the glasses fallback at `/g/?ride`.
- No `NotImplementedError` left in `apps/kiosk-pi/questline_kiosk/`.
- Every resolved TODO comment removed; READMEs say how to run each app.
