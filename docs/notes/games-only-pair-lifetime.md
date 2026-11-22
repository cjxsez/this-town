# Games-only pair lifetime (investigation)

**Status:** investigation only — no worker, phone, or room behavior change in this note.  
**Update (D28):** a games-only pair now also ends when it finishes Left for you, the last game of the playlist: both riders are stamped, the kiosk celebrates and is freed, and both rest 90 s before matching again. The other paths below (Not now, report, ghost, end ride, end of line) are unchanged, so a pair that never finishes the playlist can still hold the kiosk.  
**Context:** `GAMES_ONLY = "true"` (D26). Smoke already checks that passing a rider's stop does not end their game.

## What ends a pair today

In `TrainRoom`, `clearPair` is what frees the match and sends `pair.cleared` to the meeting kiosk. With games-only on, a pair ends only when:

| Trigger | Path | Rider sees |
|---|---|---|
| **Not now** | `notNow` → `clearPair(..., "partner-not-now")` | Clear reasons on both phones/glasses |
| **Report** (and optional block) | `applyReport` → `clearPair(..., "partner-left" / "reported")` | Reporter: reported; partner: partner-left |
| **Ghost** | `setGhost(true)` while paired → `clearPair(..., "ghost")` | Ghosting rider: ghost; partner: partner-left |
| **Rider ends the ride** | `POST /api/ride/end` / check-out → `checkOutInner` → `clearPair(..., "partner-left")` | Partner-left; check-out closes Ride Mode for that rider |
| **Trip ended** | alarm when `nextStopIdx === null` (end of line) → `checkOutInner(..., "trip-ended")` for everyone | Same as check-out |

Stops do **not** end a pair or check anyone out when `gamesOnly` is true. The stop branch in `tick` is:

```ts
for (const r of this.cfg.gamesOnly ? [] : Object.values(s.riders)) {
  if (stopIndex(s, r.destinationStop) <= s.currentStopIdx) await this.checkOutInner(...);
}
```

Missions never start (`autoStartAt: null`, arrive does not call `startMission`), so `mission-done` / stamp celebration never clears a games-only pair.

## Can a kiosk stay busy for the rest of the trip?

**Yes.** Matching uses `busyKiosks(state)` (`meetAtCar` of every live pair). A kiosk hosts one pair at a time; if both candidate meeting cars are busy, that candidate waits (`pair.ts`).

Once `pair.incoming` is sent, the screen/LEDs stay on that pair until `clearPair` sends `pair.cleared` (or, on the mission path only, after the celebrate delay). Games-only never celebrates via stamp, so idle return is exactly when the pair clears via the table above (or the whole trip ends).

`kiosk.idle` is still broadcast for rider counts / next-stop stats; the screen only treats the car as free of a pair after `pair.cleared` (see `replayToKiosk`: idle first, then re-send `pair.incoming` if a pair is still there).

So for a long games-only demo: one pair can occupy car 1413's kiosk for the whole remaining trip while they play Tall tale / First impressions / Left for you — until someone Not-nows, reports, ghosts, ends Ride Mode, or the train finishes.

## When one rider closes the app

`webSocketClose` on the room does **not** check the rider out and does **not** clear the pair. Comment in code: check-out comes from the trip or `/api/ride/end`.

Practical effects:

- The closed client's socket is gone; the other rider still has `match` / game room state.
- The pair and `meetAtCar` stay occupied; the kiosk stays on `pair.incoming`.
- Reopening the phone/glasses with the same token reconnects (`rider.hello` → `ride.snapshot`) and restores the match/game.
- There is no "partner away" signal on the ride HUD from a socket drop alone (game rooms have their own poll timeout; the TrainRoom pair does not).

## Consent / copy mismatch (D15 vs D26)

Ride Mode on is the consent promise (D15). Phone copy still describes stop-based Ride Mode end and missions, even when the worker is games-only:

| Surface | Copy (phone-web today) | Worker with `GAMES_ONLY` |
|---|---|---|
| Riding | "Ride Mode turns off at {dest}" (e.g. Government Ctr) | Destination alarm does **not** call `checkOutInner` |
| Destination / Tap hints | "missions always end before a stop" / "Ride Mode turns off at your stop" | No mission; no stop check-out |
| Turn on Ride Mode rules | "You meet at a kiosk, play a short mission…" | Match opens a game room; no kiosk mission |

So riders are told Ride Mode will turn off at their stop, but the room keeps them (and their kiosk) until Not now / report / ghost / explicit end / end of line. That is a consent-copy gap relative to D15, introduced by D26's "stops no longer … when a pair ends" without parallel phone wording.

`GET /api/health` already exposes `{ gamesOnly: true|false }` (smoke uses it). The phone does not branch these strings on that flag today.

## Options for Kenny

1. **Split check-out: unpaired vs paired.** In games-only, keep checking out **unpaired** riders at their stop (honors the Ride Mode promise for people who never matched). **Paired** riders stay until the game ends naturally, then check out (or check out when the pair clears via Not now / report / ghost / end). Frees kiosks when the game/pair ends; unpaired riders don't linger forever past their stop.

2. **Mode-aware phone copy via `GET /api/health`.** Leave room behavior as-is for the demo. When `gamesOnly` is true, change Riding / Tap / Ride Mode rules copy to something like: you stay in Ride Mode until you turn it off, Not now, or the trip ends; you meet at a kiosk and play the two-player games (no "mission before your stop" / "turns off at {dest}"). Restores honesty of the D15 consent screen without changing matching.

3. **Soft kiosk release while the pair keeps playing.** After both have arrived (or after N minutes), send `pair.cleared` to the kiosk only and clear `meetAtCar` occupancy so the screen/LEDs return to idle and another pair can use that car, while the two riders keep their game room on phone/glasses. Addresses "kiosk busy for the rest of the trip" without forcing Ride Mode off at the stop. Still need a decision on stop check-out / copy (combine with 1 or 2).

No code changes from this note — pick a direction and we can implement in a follow-up.

## Copy seen in a three-screen run (phone, /g/?ride, kiosk), games-only

Added after an end-to-end run against a local games-only worker. Same decision as above;
nothing changed.

- Kiosk, pair screen: "One more tap on the tag starts your mission" at 1 of 2 and still at
  2 of 2 here, but no mission starts; the pair plays on their phones or glasses.
- Glasses match card: pressing "I'm here" gives no visible change (the kiosk does go to
  "1 of 2 here").
- Phone destination step and Ride Mode rules still mention missions and Ride Mode turning
  off at your stop (see the table above).
- In demo mode, 90 s after finishing, the same two riders are matched again if nobody else
  shares their interests (demo mode ignores "met recently"). Fine for a demo, worth knowing
  when filming.

What worked end to end: demo rider, glasses link, kiosk check-in, the match on all three
screens, the game moving onto the lens, all three games, and the finish (stamp on the
phone, "Stamped!" on the kiosk, kiosk freed).
