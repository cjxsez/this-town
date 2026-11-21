# @questline/glasses-web

The Meta Ray-Ban Display **Web App** for Questline (decision D11). A 600x600 HUD that shows your link code, the next stop, your match ("Maya, kiosk 1 car back, look for orange"), a compact mission and your stamp. The phone decides who; the glasses tell you where to go.

Served by the worker at `https://<domain>/g/` (Vite `base: "/g/"`).

## Platform constraints

- Runs in the glasses' Chromium-based browser, as a developer preview Web App.
- **Fixed 600x600 viewport.** `#root` is exactly 600x600; nothing scrolls.
- **Additive waveguide display:** black is transparent, bright pixels are light. Backgrounds must be black. Use white or saturated text, no large bright fills.
- **Input:** we have **no Neural Band**, so the app works with zero input. The temple touch strip sends arrow keys (and Enter) as `keydown` events, which we treat as a bonus. A middle tap opens the system menu.
- **Not available:** camera, mic, text input, offline support, notifications.
- **Available:** `localStorage` (we wrap every access in try/catch).
- **The page must stay open during the ride.** There are no notifications, so a closed page means no match card.
- WebSockets are not yet confirmed in the glasses browser (decisions.md "Still open"). If they fail, the app falls back to polling `GET /api/ride/state`.

## Screen state machine

| Trigger | Screen |
|---|---|
| no token in `localStorage` | `LinkCode` |
| linked, socket connecting | `Idle` ("Connecting…") |
| `ride.state` | `Idle` (updates next stop, countdown, riders on train). Drops a stale match/mission if status is `off`/`riding` |
| `match.found` | `MatchCard` |
| "I'm here" (select) | sends `rider.arrived`, card shows "Waiting for Maya…" |
| "Not now" (back, or select on the button) | sends `rider.notNow`, `Idle` |
| `match.cleared` (same `matchId`) | `Idle` |
| `mission.start` | `Mission` |
| `mission.end` `time-up` / `cancelled` | `Idle` |
| `mission.end` `stamped` | stays, waits for `stamp.awarded` |
| `stamp.awarded` | `Stamp`, auto-dismiss after 4 s to `Idle` |
| socket dropped, retrying | `Offline` |
| socket auth failure | clear token, `LinkCode` |

## Guess who (the `/g/` root)

`/g/` opens a five-question guessing game about the person in front of you. The ride HUD described above is at `/g/?ride`, so use that URL when linking glasses for a ride. The game makes no API or socket calls.

- Two kinds of question: either/or ("Night owl" or "Day person") and a 0 to 10 scale ("How much does this person like horror movies?"). The deck is `src/game/questions.ts`.
- 20 seconds per question. If time runs out the question is recorded as "No guess" and the next one shows.
- The last screen lists the guesses and has a Restart button.
- Frame only, no Neural Band: scroll the temple strip to move the choice (left or up is previous, right or down is next), tap to lock it in. The game listens for arrow keys and Enter, and also for `wheel` and `click`, in case the strip's scroll reaches the page as scroll events. Which one the glasses send has not been checked on device: open `/g/?debug=keys` and watch the console (it logs keys, wheel deltas and clicks). If scrolling moves too fast or too slow, change `WHEEL_STEP_PX` in `src/lib/input.ts`.

## Input mapping

Nothing here is required. Every screen is driven by server events, tapping the meeting kiosk's tag counts as arriving, the mission auto-starts, and "Not now" is a button on the phone.

| Touch strip (expected) | Key | Action |
|---|---|---|
| swipe up / down / back / forward | Arrow keys | move focus |
| tap (verify) | `Enter` | select |
| back (verify) | `Escape` | back |

On the match card: select on "I'm here" (default focus) sends `rider.arrived`. Back, or select on "Not now", sends `rider.notNow`. Gesture-to-key pairs need checking on device: open `/g/?debug=keys` and watch the console. Also check whether `Escape` reaches the page or closes the Web App. Per-screen details are in `src/lib/input.ts`.

## File map

```
index.html              600x600 viewport, black theme
vite.config.ts          base /g/, port 5174, proxies /api and /ws to :8787
src/main.tsx            React entry: Guess who at /g/, ride HUD at /g/?ride
src/App.tsx             screen state machine driven by socket events
src/styles.css          600x600 root, black background, big type, focus rings
src/lib/input.ts        key -> action mapping, useInput hook (optional wheel and click)
src/game/questions.ts   Guess who deck, round size, seconds per question
src/lib/link.ts         4-digit code linking, token in localStorage
src/lib/socket.ts       /ws/rider socket, reconnect, polling fallback
src/screens/LinkCode.tsx  big 4-digit code
src/screens/Idle.tsx      next stop, countdown, riders on train
src/screens/MatchCard.tsx partner name, color, why line, where to go, I'm here / Not now
src/screens/Mission.tsx   compact title, prompt, countdown
src/screens/Stamp.tsx     brief celebration, auto-dismiss
src/screens/Offline.tsx   reconnecting
src/screens/GuessGame.tsx Guess who: start, five questions, recap and Restart
src/components/Countdown.tsx   m:ss to an epoch ms time
src/components/ColorSwatch.tsx pair color from PAIR_COLOR_HEX
```

## Run locally

From the repo root:

```bash
pnpm install
pnpm dev:worker      # worker on :8787
pnpm dev:glasses     # this app on :5174
```

Open http://localhost:5174/g/ for Guess who, or http://localhost:5174/g/?ride for the ride HUD. In dev the 600x600 lens area is outlined. To preview at the real size, use Chrome DevTools device toolbar with a custom 600x600 device, or a 600x600 window. Use arrow keys, Enter and Escape to simulate the touch strip. The Meta Ray-Ban Display Simulator Chrome extension also previews the 600x600 display.

To link in dev, run phone-web too (`pnpm dev:phone`), onboard, and enter the code from the glasses tab.

`pnpm --filter @questline/glasses-web preview` serves the production build on :5174 with the same proxy.

## Load it on the glasses

Requirements: glasses software v125+, Meta AI app v272+, and a **public HTTPS URL** (HTTP and localhost don't work).

1. Deploy: `pnpm run deploy` from the repo root (builds the web apps, copies them into `apps/worker/public/`, deploys the worker). The glasses URL is `https://<worker-host>/g/`.
2. Turn on Developer Mode once: Meta AI app > Settings > App Info, tap the app version 5 times, Enable.
3. Add the Web App: Meta AI app > App Settings > Apps > Web Apps > Connect Web App, paste `https://<worker-host>/g/`, Save.
4. On the glasses, the app shows at the bottom of the app grid (marked unverified). Pin it and open it.
5. Read the 4-digit code on the lens and enter it on the phone. Keep the Web App open for the whole ride.

Alternative install: a QR link of the form `fb-viewapp://web_app_deep_link?appName=Questline&appUrl=https://<worker-host>/g/`, scanned with the glasses.

Icons: Meta needs PNG icons (no SVG), 52x52 or larger, found via the manifest or page source. `public/manifest.webmanifest`, `public/icon-192.png` and `public/icon-512.png` cover that.

First thing to test on device: open `/g/?debug=keys` (add it as a second Web App if needed) and swipe and tap the temple to see which keys reach the page. Update `src/lib/input.ts` with what you find.

For quick testing against the dev server, an HTTPS tunnel (`cloudflared tunnel --url http://localhost:5174`) also works; `*.trycloudflare.com` is in `server.allowedHosts`. The tunnel URL changes every run, so you'd have to re-add the Web App each time.
