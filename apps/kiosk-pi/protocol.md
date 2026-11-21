# kiosk-pi protocol

The WebSocket messages this agent sends and consumes. Mirrors `packages/protocol/src/events.ts` (`ServerToKiosk`, `KioskToServer`) and `models.ts` (`PairColor`, `PAIR_COLOR_HEX`, `Mission`, `CarId`).

> **Keep in sync.** When kiosk events change in `packages/protocol`, update this file and `questline_kiosk/protocol.py` in the same PR (see CLAUDE.md rules).

## Socket

```
wss://<domain>/ws/kiosk/<car>?key=<KIOSK_KEY>&role=pi
```

- `car` is a `CarId`: `^[A-Za-z0-9-]{1,12}$`, the MBTA carriage label (e.g. `1412`).
- `key` is the shared kiosk secret. The screen (`apps/kiosk-web`) connects to the same path with `role=screen`.
- Messages are JSON: `{ "type": ..., ...payload }`.

## Pi -> server

| type | payload | when |
|---|---|---|
| `kiosk.hello` | `car: CarId`, `role: "pi"`, `hw?: { leds: boolean, nfc: "dynamic" \| "static" \| "none" }` | first message after every connect. The agent always sends `hw`. |
| `nfc.written` | `url: string` (URL) | after the tag was rewritten for an `nfc.write`. Echoes the URL written. |
| `ping` | none | every `agent.ping_interval_s` (default 20 s) |

## Server -> Pi

The Pi receives every `ServerToKiosk` event (the screen gets the same stream). What the Pi does with each:

| type | payload | Pi action |
|---|---|---|
| `kiosk.idle` | `ridersInCar: int`, `ridersOnTrain: int`, `nextStop: string \| null`, `nextStopEtaSec: int \| null` | dim idle animation, only if no pair is active (stats are for the screen) |
| `pair.incoming` | `matchId`, `color: PairColor`, `firstNames: [string, string]` | solid pair color |
| `mission.show` | `matchId`, `color: PairColor`, `mission: Mission` | slow pulse in the pair color |
| `nfc.write` | `url: string` (URL) | Pi only. Write one NDEF URI record with `url` to the tag, then send `nfc.written {url}`. Ignored when `hw.nfc` is not `dynamic`. |
| `celebrate` | `matchId`, `color: PairColor`, `rare: boolean` | burst; if `rare`, burst then rainbow. Then hold the pair color. |
| `pair.cleared` | `matchId` | back to idle, if `matchId` is the pair being shown |

Unknown `type` values are ignored (forward compatible). Known types with missing fields are logged and dropped.

## Pair colors

From `PAIR_COLOR_HEX` in `models.ts`:

| name | hex |
|---|---|
| orange | `#ff8a00` |
| green | `#22c55e` |
| blue | `#3b82f6` |
| pink | `#ec4899` |
| yellow | `#facc15` |
| purple | `#a855f7` |

## Tag contents

- Check-in: `https://<domain>/k/<car>?n=<nonce>` (dynamic tag) or `https://<domain>/k/<car>` (static sticker fallback).
- Encoded as a single NDEF URI record (TNF well-known, type `U`, prefix code `0x04` for `https://`) inside an NDEF TLV. See `questline_kiosk/nfc_tag.py`.

## Open questions (not in the contract yet)

These are assumptions the agent makes today. If the contract changes, change it in `packages/protocol` first.

1. **No error reply for `nfc.write`.** If the write fails, the Pi has no way to say so; the server has to time out waiting for `nfc.written`.
2. **No correlation on `nfc.write`.** It carries only `url`, so `nfc.written` echoes the URL to match them up. A `sessionId` or `matchId` would be cleaner.
3. **State after reconnect.** The agent assumes the server resends the current kiosk state (`kiosk.idle` or `pair.incoming`/`mission.show`, plus the current tag URL via `nfc.write`) after `kiosk.hello`. Not written down anywhere yet.
4. **`kiosk.idle` during a pair.** Unclear whether `kiosk.idle` is only sent when nothing is happening or also as periodic stats. The Pi ignores it while a pair is active and waits for `pair.cleared`.
5. **One pair per kiosk.** Two pairs meeting at the same kiosk would fight over the LEDs. The Pi shows the latest one.
6. **No pong.** `ping` has no server reply in the contract.
