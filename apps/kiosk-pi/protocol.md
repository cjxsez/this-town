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
| `nfc.written` | `writeId: string`, `url: string` | after the tag was rewritten for an `nfc.write` (same `writeId`). |
| `nfc.failed` | `writeId: string`, `reason: string` | the write failed after retries. |
| `ping` | none | every `agent.ping_interval_s` (default 20 s). Must be exactly `{"type":"ping"}`: the server's auto-response replies `{"type":"pong"}`, which the agent ignores. |

## Server -> Pi

The Pi receives every `ServerToKiosk` event (the screen gets the same stream). What the Pi does with each:

| type | payload | Pi action |
|---|---|---|
| `kiosk.idle` | `ridersInCar: int`, `ridersOnTrain: int`, `nextStop: string \| null`, `nextStopEtaSec: int \| null`, `serverNow: int` | periodic stats push, not a "go idle" command. Dim idle animation only if no pair is active. |
| `pair.incoming` | `matchId`, `color: PairColor`, `firstNames: [string, string]`, `arrived: 0-2` | solid pair color |
| `mission.show` | `matchId`, `color: PairColor`, `mission: Mission`, `serverNow: int` | slow pulse in the pair color |
| `stamp.progress` | `matchId`, `tapped: 1 \| 2` | optional flash when the first rider taps |
| `nfc.write` | `writeId: string`, `url: string` | Pi only. Write one NDEF URI record with `url` to the tag, then send `nfc.written` or `nfc.failed` with the same `writeId`. Ignored when `hw.nfc` is not `dynamic`. |
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

## Contract notes

- **Reconnect replay.** After `kiosk.hello` the server sends `kiosk.idle`, then `pair.incoming` / `mission.show` for an active pair, and (role=pi) `nfc.write` with the current tag URL.
- **One pair per kiosk.** A kiosk hosts at most one pair at a time; the matcher treats a busy kiosk as unavailable. If two ever arrive, show the latest.
- **Missing `hw`** in `kiosk.hello` defaults to `{ leds: false, nfc: "static" }` on the server. The agent always sends it.
