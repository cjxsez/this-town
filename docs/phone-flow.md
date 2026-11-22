# Phone flow

Every screen of `apps/phone-web`, in order. Ids match `/screens/:id` in the dev gallery. The rules behind them are in `architecture.md`; the consent rule is decision D15.

## Onboarding (once)

| Id | Route | Screen |
|---|---|---|
| B1 | `/` | Landing. "Join" or "Just play today" (demo profile) |
| B2 | `/join/name` | First name, local / student / visiting |
| B3 | `/join/interests` | Pick interests (at least one) |
| B4 | `/join/about` | Optional "Ask me about" line |
| B5 | `/join/battery` | Social battery: nod, chat, talk |
| B6 | `/join/ride-mode` | Ride Mode rules. Required checkbox: "I'm 18+ and I get it: Ride Mode on means I can be matched." "Start riding" creates the rider and goes to Ride Mode (or back to a kiosk tap made before joining) |

Glasses are not part of sign-up (D22). Riders with Meta Ray-Ban Display link them from Me > Glasses (J1) with the 4-digit code on the lens.

## Turning Ride Mode on (every ride)

| Id | Route | Screen |
|---|---|---|
| C1 | `/ride` | Ride Mode off. "Tap the kiosk in your car" |
| | `/k/:car` | Tag tap. "Where are you getting off?" (last stop pre-picked), then Next |
| | `/k/:car` | "Turn on Ride Mode?" Car, stop and what it means: matched with no accept step, what your match and the kiosk see, Not now and ghost, turns off at your stop. "Turn on Ride Mode" sends `rideMode: true`. "Not today" sends nothing |
| | `/k/:car` | "Ride Mode is on." Car, stop, next stop, "Got it" |

Other things a tag tap can show: "You're in car N now" (moved cars), "You made it" (meeting kiosk), "Ride Mode is already on", "1 of 2 tapped", "Stamped!", or an error.

## The ride

| Id | Screen |
|---|---|
| C2 | Riding. Car, stops, riders on the train, ghost toggle, mood. The Ride Mode switch asks "Turn off Ride Mode?" ("Keep it on" / "Turn it off") |
| C3 | Riding, offline banner |
| E1 | Matched. Name, pair color, why you two, where to go (kiosk N cars forward or back). "I'm at the kiosk", and "Not now" with a confirm |
| E2 | Matched, they come to you |
| E3 | Arrived, waiting for the mission |
| D3 | "Not this one." Your match left or said not now. Back to riding |
| D4 | "Skipped." You said not now. Back to riding |
| F1 | Mission on the kiosk screen, with the countdown and how to tap for the stamp |
| F3 | Mission, 1 of 2 tapped |
| G2 | Stamp |
| H1 | Recap, optional note, "Back to riding" |
| C4 | "Ride Mode is off." You reached your stop, with this ride's stamps and people |
| C5 | "Ride Mode is off." You turned it off |

## After

Passport (`/passport`), People (`/people`, with report and block), Me (`/me`), Glasses (`/me/glasses`). "Delete my data" on Me turns Ride Mode off and removes the rider on the worker.
