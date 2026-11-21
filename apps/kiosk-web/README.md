# @questline/kiosk-web

The touchscreen UI in each train car's kiosk (decision D7). Runs in Chromium kiosk mode on a Raspberry Pi 7" screen, 800x480 landscape. Shows idle stats and "Tap to play", the incoming pair in their color, the mission with a big countdown, and a celebration when they stamp.

Served by the worker at `https://<domain>/kiosk/:car` (Vite `base: "/kiosk/"`). The car comes from the path, the kiosk key from `?key=` (saved to `localStorage`, used as a fallback when the query is missing).

## Privacy rule

**The screen is public.** It shows first names and pair colors only. Never interests, never the "why you two" line, never anything from a profile. `ServerToKiosk` in `packages/protocol` is built so the kiosk never receives those; keep it that way.

## Event to screen map

Socket: `/ws/kiosk/:car?key=&role=screen`. On open it sends `kiosk.hello { car, role: "screen" }`.

| Event | Screen |
|---|---|
| bad URL (no car or key) | `Disconnected` (setup error) |
| socket dropped, retrying | `Disconnected` (reconnecting) |
| `kiosk.idle` | updates riders in car / on train / next stop; `Idle` when no pair is active |
| `pair.incoming` | `PairIncoming`: color fill, "Maya & Andres, meet here" |
| `mission.show` | `Mission`: title, prompt, big countdown, "Tap the tag to stamp" |
| `celebrate` | `Celebrate`: color burst (gold for `rare`), back to `Idle` after 6 s |
| `pair.cleared` | `Idle` |
| `nfc.write` | ignored (for the Pi agent) |

## File map

```
index.html                  800x480 viewport
vite.config.ts              base /kiosk/, port 5175, proxies /api and /ws to :8787
src/main.tsx                React entry, blocks context menu / zoom
src/App.tsx                 state machine on ServerToKiosk events
src/styles.css              800x480, big type
src/lib/config.ts           car from /kiosk/:car, key from ?key= or localStorage
src/lib/socket.ts           /ws/kiosk/:car socket, kiosk.hello, reconnect, drops nfc.write
src/screens/Idle.tsx        riders in car / on train, next stop, Tap to play
src/screens/PairIncoming.tsx color fill + first names
src/screens/Mission.tsx     title, prompt, countdown, tap hint
src/screens/Celebrate.tsx   color burst, rare variant
src/screens/Disconnected.tsx reconnecting / setup error
src/components/Countdown.tsx m:ss to an epoch ms time
src/components/NfcHint.tsx  NFC icon + label
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
