# Decisions

What we changed from the v1 spec (`docs/archive/questline-spec-v1.md`) and why. Newest first. Add a row when you change a decision.

| # | Decision | Replaces (v1) | Why |
|---|---|---|---|
| D15 | The game is called **In This Town**. The T of TOWN is a green roundel, for the T (the MBTA). A 3D start screen (`packages/start-screen`) opens the phone app once per visit. Players see the new name; code identifiers, the database and `questline.page` keep "questline" | Questline; the app opened straight on the landing page | The name is about Boston and its train, and the T carries the nod. Renaming code identifiers and the domain would be churn for nothing a player sees |
| D14 | One vocabulary, the phone's: its 34 interest ids are the protocol's `InterestTag`, social battery is `nod/chat/talk`, status `local/student/visiting`, and stops carry ids that match the phone's station catalog. The demo trip moved to the Green Line D branch (Kenmore to Government Ctr) to match the phone's station art | 25 worker tags folded from the phone's list; stop names only; Orange Line demo | Kenny's phone design and the worker were built from different specs. One source of truth beats an adapter that pads interests and guesses station ids |
| D13 | Glasses work with zero input. Arrival = tapping the meeting kiosk's tag, missions auto-start, "Not now" is on the phone. Temple touch strip is a bonus | Neural Band pinch for "I'm here" / "Not now" | We don't have the Neural Band. The touch strip sends arrow keys, but which gesture sends Enter / Back isn't documented |
| D12 | Host everything on one Cloudflare Worker: static assets for the 3 web apps, Hono API, D1, one `TrainRoom` Durable Object per trip | Separate backend | One deploy, one HTTPS origin (needed for the glasses Web App and NFC links), DOs are a natural fit for per-train live state |
| D11 | No native app. Phone is a web app, glasses are a Meta Ray-Ban Display **Web App** | iOS app + Device Access Toolkit | We dropped camera and voice, so the Web App covers everything we need. Cuts Swift, Xcode and Meta SDK setup. Tradeoff: the glasses page must stay open during the ride (no notifications) |
| D10 | Glasses link via a 4-digit code shown on the lens and typed on the phone | n/a | Glasses Web Apps have no text input |
| D9 | Location comes from tapping the kiosk NFC tag (check-in to a car). No BLE beacons, no GPS | BLE badge RSSI + station beacons | iPhones read NFC tags in the background and open the link. No location permission, no background BLE limits, works underground |
| D8 | Stamp proof: both riders tap the tag with the current nonce, which the Pi rewrites per mission | Badge-to-badge BLE/NFC handshake | iPhones can't act as an NFC card, but they read tags fine. Fresh nonce stops photo replay |
| D7 | A kiosk per train car (Pi + touchscreen + LED strip + dynamic NFC tag) | Wearable badge, camera lock-on, AprilTag | Fixed meeting point solves "which person is it", gives a shared screen for the mission, and is real hardware to demo |
| D6 | Matching: same trip + overlapping remaining stops, interest gate, then closest car wins | Mutual top-match, interest-ranked, platform first | "Closest person who shares interests" is simpler and works on a moving train |
| D5 | Ride Mode on = consent. No accept step. One pinch for "Not now", ghost mode always available | Both say yes per mission | Fewer steps. "Not now" covers the "not this person right now" case |
| D4 | On-train play is primary. Platform play is out of scope for now | Platform primary | The kiosk lives in the car |
| D3 | No camera, no voice, no AR anchoring | Lock-on reticle, voice yes/skip | The display is a fixed HUD, not world-anchored AR. Camera and mic aren't available to Web Apps anyway |
| D2 | No UWB arrows | Directional arrows to your match | UWB direction is unreliable on newer iPhones and needs foreground + a forward-facing device. The kiosk meeting point makes it unnecessary |
| D1 | Missions still come from a curated deck, still fit before the next stop minus 30 s | (unchanged) | Safety and latency |

## Still open

- Domain name.
- Can we get an NTAG I2C plus or ST25DV board this weekend, or do we ship static stickers?
- Confirm WebSockets work in the glasses browser. If not, glasses-web falls back to polling `GET /api/ride/state`.
- Live MBTA: only Orange and new Red Line cars report car-level data, so live check-in will start there. The demo runs on a scripted Green Line trip (D14).
