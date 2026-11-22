# @questline/kiosk-web

The touchscreen UI in each train car's kiosk (decision D7). Runs in Chromium kiosk mode on a Raspberry Pi 7" screen, 800x480 landscape. Shows idle stats and "Tap to play", the incoming pair in their color, the mission with a big countdown, and a celebration when they stamp.

It wears the phone app's look: sea background, paper cards with ink outlines, Bungee block letters, Gaegu handwriting, the IN THIS TOWN letter tiles. Tokens in `src/styles/tokens.css` are copied from `apps/phone-web/src/styles/tokens.css`; keep them in step. Screens are laid out on an 800x480 stage that scales to fit the window, so the same build works on the Pi and full screen on a laptop or TV.

Served by the worker at `https://<domain>/kiosk/:car` (Vite `base: "/kiosk/"`). The car comes from the path, the kiosk key from `?key=` (saved to `localStorage`, then stripped from the URL with `history.replaceState`).

## Privacy rule

**The screen is public.** It shows first names and pair colors only. Never interests, never the "why you two" line, never anything from a profile. `ServerToKiosk` in `packages/protocol` is built so the kiosk never receives those; keep it that way.

## Event to screen map

Socket: `/ws/kiosk/:car?key=&role=screen`. On open it sends `kiosk.hello { car, role: "screen" }`.

| Event | Screen |
|---|---|
| bad URL (no car or key) | `Disconnected` (setup error) |
| socket dropped, retrying | `Disconnected` (reconnecting); page reloads after 5 min offline |
| `WS_CLOSE.badAuth` / `forbidden` | `Disconnected` (bad key / unknown car), no retry |
| `WS_CLOSE.tripChanged` | reconnect immediately |
| `kiosk.idle` | stats push only: updates riders in car / on train / next stop (does not reset a pair) |
| `pair.incoming` | `PairIncoming`: color fill, both initials, "Maya & Andres", how many are here. Body copy follows `GET /api/health` `gamesOnly`: mission mode says the tag starts your mission; games-only says find each other here and play on phones or glasses. A new matchId replaces the previous pair (worker: one pair per kiosk, no split screen) |
| `mission.show` | `Mission`: title, prompt, countdown with a draining bar, "Both tap the tag" |
| `stamp.progress` | fills the two tap dots on `Mission` |
| `celebrate` | `Celebrate`: color burst (gold for `rare`), back to `Idle` after 6 s |
| `pair.cleared` | `Idle` only when it matches the pair on screen |
| `nfc.write` | ignored (for the Pi agent) |

On `Idle`, tap anywhere for a 10 s "How it works" overlay (three steps, no names or interests).

## File map

```
index.html                  800x480 viewport
vite.config.ts              base /kiosk/, port 5175, proxies /api and /ws to :8787
public/art/                 sprites copied from phone-web/public/art (town strip on Idle)
src/main.tsx                React entry, ErrorBoundary, blocks context menu / zoom
src/ErrorBoundary.tsx       night-sea crash card; reloads after 5 s
src/App.tsx                 state machine on ServerToKiosk events, ?preview= screens
src/styles.css              the phone look on the kiosk: cards, pills, tiles, motion
src/styles/tokens.css       colors and fonts, copied from phone-web
src/lib/config.ts           car from /kiosk/:car, key from ?key= or localStorage (key stripped from URL)
src/lib/clock.ts            serverNow offset for countdowns
src/lib/preview.ts          sample data for ?preview=
src/lib/socket.ts           /ws/kiosk/:car socket, kiosk.hello, reconnect, drops nfc.write
src/screens/Idle.tsx        Tap to play, riders / next stop, How it works overlay, town strip
src/screens/PairIncoming.tsx color fill, initials, first names
src/screens/Mission.tsx     title, prompt, countdown + drain bar, tap dots
src/screens/Celebrate.tsx   stamp ticket, rays, confetti, rare variant
src/screens/Disconnected.tsx reconnecting / setup error (night sea)
src/components/Stage.tsx    scales the 800x480 stage to the window
src/components/Ui.tsx       Wordmark, PairToken, NfcMark, Screen, hand-drawn filters
src/components/Countdown.tsx m:ss to an epoch ms time, drain bar
```

## Run locally

From the repo root:

```bash
pnpm install
pnpm dev:worker     # worker on :8787
pnpm dev:kiosk      # this app on :5175
```

Open http://localhost:5175/kiosk/1412?key=<KIOSK_KEY> (the key from the worker's `.dev.vars`). Size the window to 800x480, or use a DevTools custom device. With `pnpm ghosts` running, the demo train produces pairs and missions.

`pnpm --filter @questline/kiosk-web preview` serves the production build on :5175 with the same proxy.

## On the Pi

`apps/kiosk-pi` launches Chromium in kiosk mode pointed at the deployed build (`python -m questline_kiosk browser`, run by `systemd/questline-browser.service`). It execs roughly:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  "https://<domain>/kiosk/<car>?key=<KIOSK_KEY>"
```

The real flags live in the Pi's `config.toml` (`browser.flags`). The Pi agent opens its own socket to the same URL with `role=pi` for the LEDs and the NFC tag; this screen does not talk to the Pi directly. Launch flags and autostart live in `apps/kiosk-pi/README.md` and `docs/hardware.md`.

## Preview the screens

No socket or key needed, sample names only:

```
http://localhost:5175/kiosk/1412?preview=all        cycles every 6 s
http://localhost:5175/kiosk/1412?preview=idle       or pair, mission, celebrate, rare, offline
```

Same on production: `https://<domain>/kiosk/1412?preview=all`.
