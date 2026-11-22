# Demo script (about 3 minutes)

The demo trip is the Green Line D branch inbound: Kenmore, Hynes, Copley, Arlington, Boylston, Park St, Government Ctr (`apps/worker/src/mbta/demo.ts`). Cars **1413** (front) and **1412** (behind).

Setup: two kiosks on the table labeled **car 1412** and **car 1413**. 1413 is where you meet Maya, so it needs the full kiosk (screen, LEDs, dynamic tag). 1412 can be just a tag + LED strip. Two riders: one wearing the glasses, one teammate as "Maya". `pnpm seed && pnpm ghosts --car 1412` so the kiosks show a few riders on the train, **then stop the ghosts (Ctrl+C) before Maya taps in**: ghosts are ordinary riders, the closest one who shares an interest wins, and the seeded ghosts never pair off with each other, so a ghost in your car can take your match. Start from a fresh trip with `POST /api/demo/reset` (header `x-kiosk-key`).

> **Which flow is live.** `GAMES_ONLY = "true"` in `apps/worker/wrangler.toml` (D26) is the
> default: arriving at the kiosk starts no mission, and the pair plays Tall tale, First
> impressions and Left for you from the match screen (`/m`; "Play on my glasses" moves a
> seat to the lens). Steps 4 to 6 below are the kiosk-mission demo; for it, run the worker
> with `--var GAMES_ONLY:false`. `curl <worker>/api/health` shows which one is running, and
> `pnpm smoke` checks that one. In games-only the ending is pressing Finish after Left for you (D28): both
> riders get a stamp and kiosk 1413 celebrates, so steps 5 and 7 still happen. The glasses at
> `/g/?ride` switch to the game on their own once Maya opens it on her phone.

1. **Onboarding (20 s).** Show the quick phone screens. Link glasses: the lens shows a 4-digit code, type it on the phone.
2. **Board (20 s).** Tap the car 1412 tag. Banner pops, tap it, pick destination "Government Ctr" so the ride lasts the whole demo. Kiosk idle screen ticks up the riders in this car.
3. **Match (30 s).** Maya taps in on car 1413. No accept step. Glasses: "Maya, kiosk 1 car forward, look for orange" and the why line. Car 1413's LEDs glow orange. Maya boarded last, so she stays put and you walk.
4. **Mission (40 s).** Tap the car 1413 tag when you get there: that's arriving, and the mission starts (it also starts on its own after 20 s). The kiosk shows the prompt with a countdown to Hynes. Glasses show the compact version.
5. **Stamp (20 s).** The Pi rewrites the tag with a fresh code. Both tap (the tap is the confirmation). Kiosk celebrates in orange, glasses show the stamp.
6. **Late bonus (20 s).** `POST /api/demo/delay`, then `POST /api/demo/advance` to reach Hynes. You're matched again for the next segment and get a rare late-train mission, shown with the gold rare accent.
7. **Close (20 s).** Passport on the phone. Line: "The phone decides who. The glasses and the kiosk make it happen."

Fallbacks: if the glasses misbehave, open `/g/?ride` in a 600x600 browser window on the laptop. If the dynamic tag fails, swap in the static sticker. `pnpm smoke` runs this whole flow headless against a worker, as a pre-demo check.
