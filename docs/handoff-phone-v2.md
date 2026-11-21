# Phone ride flow: moving to the v2 product

For Kenny. The worker now runs the whole happy path (see `apps/worker/README.md`, "Status"), and `packages/protocol` uses the phone's vocabulary (decision D14). What's left is the phone's ride flow, which still follows the v1 spec in a few places. The adapter already bridges the worst of it; this is the list to finish it in the screens and the simulator.

The product, in one line: tap the kiosk in your car to start, get matched with the closest rider who shares your interests (no accept step), meet at a kiosk, play a mission on its screen, both tap the tag for a stamp.

## Already done in `src/api/backend/` (this PR)

- `match.found` goes straight to `matched` (E1). The 60 s offer timer that sent "Not now" is gone: the phone is usually in a pocket while the glasses show the match.
- Interests are the protocol's ids now, no folding or padding. Battery and rider kind pass through as is.
- Stations come with ids (`RideState.nextStopId`, `Stamp.stationId`) that match `shared/catalog.ts`, and the demo trip is Kenmore to Government Ctr, so art and stamps line up.
- The destination picker (`/k/:car`) gets `{ id, name }` stops and sends the id.

## Screens to change

| Phase | Today | v2 |
|---|---|---|
| `off` C1 CheckIn | pick station, line, direction on the platform | "Tap the kiosk in your car" (one big hint). Check-in happens on `/k/:car`. Keep `VITE_DEMO_CAR` as a dev shortcut. |
| `waiting` C2 | countdown to the train | "Riding to {destination}", next stop countdown, riders on this train |
| `noMatch` C4 | train came, no quest | "Nobody on this train matches yet." Shown while riding with no match; no "train came" moment |
| `offer` D1, `offerYes` D2 | Yes / Skip offer | **Delete.** Unreachable in http mode already |
| `fellThrough` D3 | skip, timeout, call-off | Keep as the neutral "that one fell through" for `match.cleared` before a mission |
| `meet` E1 | go to a platform landmark | "Kiosk N cars forward/back (car 1413), look for {color}" or "Stay put, {name} is coming to you". Add a **Not now** button (`withdraw()`) |
| `cantSpot` E2 | can't find them | Drop, or "Can't find the kiosk?" with the car number. The kiosk glows, so it's rarely needed |
| `greeting` E3 | scripted password, "badge read by your glasses" | **Delete.** Tapping the kiosk tag is arriving |
| `mission` F1 | phone shows the mission | Keep, but the kiosk screen is the main surface; phone mirrors it |
| `bump` G1 | bump phones | "Tap the kiosk tag" with "1 of 2 tapped" from `stamp.progress` |
| `stamp` G2 | stamp + photo ask | Keep the stamp, **drop the photo ask** |
| `photo` G3, `keep` G4 | glasses take a photo | **Delete.** No camera (CLAUDE.md rules) |
| `recap` H1 | recap | Keep |
| F3 TrainSoon | train in 30 s | "Next stop in 30 s" (mission ends 30 s before the stop) |

## Elsewhere

- Onboarding: drop `BadgeScan` (B7) and `/print/badge`. Add a "Link your glasses" step that posts the 4-digit code to `POST /api/glasses/link` (`api.linkGlasses` exists).
- Me > Glasses: wire to the real link instead of the simulation.
- Memories: delete (no photos).
- Passport: read `GET /api/passport` instead of `localStorage`.
- Poster: repurpose as the "tap here" sign for a kiosk tag (`/k/<car>`), not a platform QR.
- Animal badges and passwords: replace with the pair color everywhere.
- `rideSim.ts`: play the v2 flow (`checkedIn` -> `matched` -> `missionAssigned` -> `partnerBumped` -> `stampAwarded`) so mock mode demos the real product.

## Try it against the worker

```bash
pnpm db:migrate:local && pnpm dev:worker          # terminal 1
cp apps/phone-web/.env.example apps/phone-web/.env.local
pnpm dev:phone                                    # terminal 2, http mode
pnpm seed && pnpm ghosts --car 1413 --auto        # terminal 3: Maya and friends ride
```

Onboard with "ramen" or "film" to get matched with Maya. `pnpm smoke` shows every event in order if you want to see the wire traffic.
