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
| `stamp.progress` (tapped: 1) | `Mission` shows "1 of 2 tapped" |
| `mission.end` `time-up` / `cancelled` | `Idle` |
| `mission.end` `stamped` | stays, waits for `stamp.awarded` (falls back to `Idle` after 5 s) |
| `stamp.awarded` | `Stamp`, auto-dismiss after 4 s to `Idle` |
| `ride.snapshot` (reload / poll) | restores match or mission from the snapshot |
| socket dropped, retrying | `Offline` |
| socket auth failure (`WS_CLOSE.badAuth`) | clear token, `LinkCode` |
| send failed (polling REST) | bottom line "Couldn't send" for 3 s |

## Games (the `/g/` root)

`/g/` plays three games between the glasses and a phone, for two people sitting together. The lens shows a 4-digit code; the other player opens `/m` on a phone and types it. From then on both devices show the same game, each from its own seat, and the worker keeps them in step (`GameRoom`, see the worker README). The ride HUD described above is at `/g/?ride`, so use that URL when linking glasses for a ride. On a match that comes with a game, the ride HUD moves the rider's seat onto the lens by itself and switches from the match card to the game once the partner opens it (D28), so no input is needed.

| Game | What happens |
|---|---|
| Tall tale | Each player is secretly dealt "Tell the truth" or "Make it up", tells their worst T story in turn (18 s each), then both call the other's story True or Made up. A point for a right call, a point for fooling your partner |
| First impressions | Two questions about your partner, at least one about Boston or the T, on a slider. One question is a pick of two (cats or dogs), not a slider. Both guess at the same time (8 s), then each player sees only what their partner guessed about them, the pair talks (12 s), and each rates that guess Spot on / Close / Way off (Yes / No for the pick of two) |
| Left for you | Two trivia questions (12 s each) left by earlier pairs, answered as a team with one shared highlight. Then the pair leaves a question about the T or Boston (typed on the phone, 30 s); the model writes the three wrong answers and the next pair gets it, with the first names of the pair who left it ("Left for you by Maya and Sam") when they came from a match; every other question says "Left for you by Andres and Kenny" for the demo |

- The game rules live in `packages/protocol/src/games/` as pure modules. The screens here only draw the view for their seat and send actions. Anything a player must not see (the other card, an unlocked guess) is not in their view at all.
- Clients poll `GET /api/game/rooms/:code` every 700 ms. Timers are deadlines in server time, so both clocks agree.
- Every game's last screen has "Next game" (focused) and "Again". Either player can press; both move.
- `/g/?room=1234` fixes the code (handy for a demo: the phone link is then `/m?code=1234`). `/g/?join=1234` joins someone else's room as the second seat, for testing without a phone.
- The end-of-game buttons are votes (D29): nothing moves until both players pick the same. Your pick gets a tick, and a line says whether you're waiting for your partner or what they picked.
- After Left for you, the last game, the end screen has one button, Finish; the room also finishes by itself 20 s later. Then both devices show "Thanks for playing" and the room never restarts (D28).
- A player already in a game on a phone can move it here: they tap "Play on glasses" at `/m` and type the code this screen shows. The lens then plays their seat until the phone takes it back, and shows a fresh wait screen after.
- The room code is kept in `sessionStorage`, so a reload rejoins the same game. If the other device stops polling for about 5 s, a "partner away" screen shows until it is back.
- The look is the phone app's (Gaegu and Bungee, wobbly outlines, yellow primary button) redrawn for the lens: black background, outlines in place of paper cards, only the focused choice filled. Shared styles are in `src/guess.css`, scoped under `.guess`; each game adds its own CSS next to its screen. Fonts are bundled from `@fontsource`.
- Input: scroll the temple strip to move, tap to choose. The games listen for arrow keys and Enter, and also for `wheel` and `click`. Which one the glasses send has not been checked on device: open `/g/?debug=keys` and watch the console. If scrolling moves too fast or too slow, change `WHEEL_STEP_PX` in `src/lib/input.ts`.
- The glasses cannot type, so in Left for you the phone player writes the question while the lens shows the prompt.

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
src/main.tsx            React entry: games at /g/, ride HUD at /g/?ride
src/Games.tsx           game shell: opens a room, shows the code, then the current game
src/play/               one folder per game (tale, impressions, trivia): the lens screen and its CSS
src/lib/room.ts         useRoom (poll the room, send actions), useSecondsLeft
src/screens/Pair.tsx    the 4-digit code for the phone
src/App.tsx             screen state machine driven by socket events
src/styles.css          600x600 root, black background, big type, focus rings
src/guess.css           all games: phone fonts and colors as outlines on black
src/lib/input.ts        key -> action mapping, useInput hook (optional wheel and click)
src/lib/link.ts         4-digit code linking, 429 backoff, token in localStorage
src/lib/socket.ts       /ws/rider socket, WS_CLOSE handling, REST send fallback, pause when hidden
src/lib/clock.ts        serverNow offset for countdowns
src/lib/wakeLock.ts     screen wake lock while the ride HUD is open
src/ErrorBoundary.tsx   black "Something broke. Swipe to reload." screen
src/screens/LinkCode.tsx  big 4-digit code, then "Linked as <firstName>" for 2 s
src/screens/Idle.tsx      next stop, countdown, riders on train
src/screens/MatchCard.tsx partner name, color, why line, where to go, I'm here / Not now
src/screens/Mission.tsx   compact title, prompt, countdown, tap progress
src/screens/Stamp.tsx     brief celebration, auto-dismiss
src/screens/Offline.tsx   reconnecting
src/components/EndButtons.tsx  end of a game: Next game and Again
src/components/Clock.tsx       m:ss pill for a game deadline in server time
src/components/Countdown.tsx   m:ss to an epoch ms time (server clock)
src/components/ColorSwatch.tsx pair color from PAIR_COLOR_HEX
```

## Run locally

From the repo root:

```bash
pnpm install
pnpm dev:worker      # worker on :8787
pnpm dev:glasses     # this app on :5174
```

Open http://localhost:5174/g/ for the games (and http://localhost:5173/m in a second window for the phone seat; needs `pnpm dev:phone`), or http://localhost:5174/g/?ride for the ride HUD. In dev the 600x600 lens area is outlined. To preview at the real size, use Chrome DevTools device toolbar with a custom 600x600 device, or a 600x600 window. Use arrow keys, Enter and Escape to simulate the touch strip. The Meta Ray-Ban Display Simulator Chrome extension also previews the 600x600 display.

To link in dev, run phone-web too (`pnpm dev:phone`), onboard, and enter the code from the glasses tab.

`pnpm --filter @questline/glasses-web preview` serves the production build on :5174 with the same proxy.

## How to run the fallback

When the real glasses misbehave in a demo, open the ride HUD on the laptop instead of the games root (see `docs/demo-script.md`).

1. Worker on `:8787` (`pnpm dev:worker`) and this app on `:5174` (`pnpm dev:glasses`).
2. Open a **600×600** browser window to `http://localhost:5174/g/?ride` (not `/g/` — that is the two-player games). The lens area is outlined in dev.
3. The page shows a 4-digit link code. On the phone (or via `POST /api/glasses/link` in tooling), enter that code for the rider who should wear the glasses.
4. After link, the HUD goes Idle (next stop / connecting). Check the rider in with Ride Mode on; when they match, the same window shows the match card (partner, color, where to go). With `GAMES_ONLY` the worker does not start a kiosk mission — stay on the match card / game on the phone; with missions off that flag, a mission screen can follow.
5. If WebSockets fail in that browser, the page falls back to polling `GET /api/ride/state` (same token; 2 s while matched, 5 s otherwise). Keep the window open for the ride; closing it is like closing the Web App on the glasses.

Arrow keys / Enter / Escape simulate the temple strip for "I'm here" and "Not now" on the match card.

## Load it on the glasses

Requirements: glasses software v125+, Meta AI app v272+, and a **public HTTPS URL** (HTTP and localhost don't work).

1. Deploy: `pnpm run deploy` from the repo root (builds the web apps, copies them into `apps/worker/public/`, deploys the worker). The glasses URL is `https://<worker-host>/g/`.
2. Turn on Developer Mode once: Meta AI app > Settings > App Info, tap the app version 5 times, Enable.
3. Add the Web App: Meta AI app > App Settings > Apps > Web Apps > Connect Web App, paste `https://husshusshuss.boston/g/`, Save.
4. On the glasses, the app shows at the bottom of the app grid (marked unverified). Pin it and open it.
5. Read the 4-digit code on the lens and enter it on the phone. Keep the Web App open for the whole ride.

Alternative install: a QR link of the form `fb-viewapp://web_app_deep_link?appName=Questline&appUrl=https://husshusshuss.boston/g/`, scanned with the glasses.

Icons: Meta needs PNG icons (no SVG), 52x52 or larger, found via the manifest or page source. `public/manifest.webmanifest`, `public/icon-192.png` and `public/icon-512.png` cover that.

First thing to test on device: open `/g/?debug=keys` (add it as a second Web App if needed) and swipe and tap the temple to see which keys reach the page. Update `src/lib/input.ts` with what you find.

For quick testing against the dev server, an HTTPS tunnel (`cloudflared tunnel --url http://localhost:5174`) also works; `*.trycloudflare.com` is in `server.allowedHosts`. The tunnel URL changes every run, so you'd have to re-add the Web App each time.
