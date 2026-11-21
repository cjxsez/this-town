# @questline/glasses-web

The Meta Ray-Ban Display **Web App** for Questline (decision D11). A 600x600 HUD that shows your link code, the next stop, your match ("Maya, kiosk 1 car back, look for orange"), a compact mission and your stamp. The phone decides who; the glasses tell you where to go.

Served by the worker at `https://<domain>/g/` (Vite `base: "/g/"`).

## Platform constraints

- Runs in the glasses' Chromium-based browser, as a developer preview Web App.
- **Fixed 600x600 viewport.** `#root` is exactly 600x600; nothing scrolls.
- **Additive waveguide display:** black is transparent, bright pixels are light. Backgrounds must be black. Use white or saturated text, no large bright fills.
- **Input:** Neural Band arrow keys, Enter, Escape, plus temple swipe. All of it arrives as `keydown` events.
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

## Input mapping

| Gesture | Key | Action |
|---|---|---|
| swipe up / down / left / right (Neural Band or temple) | Arrow keys | move focus |
| select pinch / temple tap | `Enter` | select |
| back pinch | `Escape` | back |

On the match card: select on "I'm here" (default focus) sends `rider.arrived`. Back, or select on "Not now", sends `rider.notNow`. Gesture-to-key pairs need checking on device: open `/g/?debug=keys` and watch the console. Also check whether `Escape` reaches the page or closes the Web App. Per-screen details are in `src/lib/input.ts`.

## File map

```
index.html              600x600 viewport, black theme
vite.config.ts          base /g/, port 5174, proxies /api and /ws to :8787
src/main.tsx            React entry
src/App.tsx             screen state machine driven by socket events
src/styles.css          600x600 root, black background, big type, focus rings
src/lib/input.ts        key -> action mapping, useInput hook
src/lib/link.ts         4-digit code linking, token in localStorage
src/lib/socket.ts       /ws/rider socket, reconnect, polling fallback
src/screens/LinkCode.tsx  big 4-digit code
src/screens/Idle.tsx      next stop, countdown, riders on train
src/screens/MatchCard.tsx partner name, color, why line, where to go, I'm here / Not now
src/screens/Mission.tsx   compact title, prompt, countdown
src/screens/Stamp.tsx     brief celebration, auto-dismiss
src/screens/Offline.tsx   reconnecting
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

Open http://localhost:5174/g/. In dev the 600x600 lens area is outlined. To preview at the real size, use Chrome DevTools device toolbar with a custom 600x600 device, or a 600x600 window. Use arrow keys, Enter and Escape to simulate the Neural Band.

To link in dev, run phone-web too (`pnpm dev:phone`), onboard, and enter the code from the glasses tab.

`pnpm --filter @questline/glasses-web preview` serves the production build on :5174 with the same proxy.

## Load it on the glasses

The glasses need an HTTPS origin, so load the build the worker serves:

1. `pnpm deploy` from the repo root (builds all web apps, copies them into `apps/worker/public/`, deploys the worker).
2. In the Meta Ray-Ban Display developer preview, add a Web App pointing at `https://<domain>/g/`.
3. Open it on the glasses, read the 4-digit code, enter it on the phone.
4. Keep the Web App open for the whole ride.

For quick on-device testing against the dev server, an HTTPS tunnel (for example `cloudflared tunnel --url http://localhost:5174`) works; `*.trycloudflare.com` is already in `server.allowedHosts`. The URL is the tunnel host plus `/g/`.

TODO: write down the exact developer preview steps once we have done it once.
