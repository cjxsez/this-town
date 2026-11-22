# Filming on a real train

How to record the demo video on the T. It's the stage demo (`docs/demo-script.md`) moved onto a moving Green Line train, with the changes a real train needs.

## Where: Green Line B, outbound along Comm Ave

- Board at **Blandford St** outbound and ride toward Boston College. The line is above ground the whole way, so it has daylight and cell signal for the phones and the kiosk hotspot. It also runs past BU, which the start screen shows.
- Set `DEMO_LINE = "Green-B"` in `apps/worker/wrangler.toml`, deploy, then `POST /api/demo/reset`. The phone then shows BU East, BU Central, Amory St and so on, which matches the stops outside the window. Set it back to `Green-D` for the stage demo.
- The scripted trip runs about 30 minutes, with about 2 minutes per stop. It doesn't follow the real train. If the real train gets ahead, `POST /api/demo/advance` moves the script on one stop. At Boston College everyone is checked out.
- Games-only (D26) ignores stops, so a pair keeps playing whatever stop the clock shows.

## Both kiosks go in one car

Green Line cars aren't connected (there's no passage between them), and on the Red and Orange Lines the end doors are for emergencies only. So **"car 1412" and "car 1413" are the two ends of one physical car.** The worker only knows the labels, so the glasses still say "kiosk 1 car forward" and you walk down the aisle.

- Front of the car: **1413**, the full kiosk (screen + LEDs). Maya sits here and stays put.
- Back of the car: **1412**, which can be just a static NFC sticker (`https://husshusshuss.boston/k/1412`). Games-only needs no fresh nonce, so a sticker is enough to check in.
- Print big "1412" / "1413" labels so viewers can follow along.

## The flow on camera (games-only)

1. You tap the 1412 sticker. The banner opens Safari; pick a stop, then **Turn on Ride Mode**.
2. Maya taps 1413 and you're matched. The glasses (`/g/?ride`) show the match card, and the LEDs at 1413 light up in the pair color.
3. You walk to 1413 and tap it. That counts as arriving.
4. Maya taps **Play a game together** on her phone. Your glasses switch from the match card to the game on their own (D28), so no Neural Band is needed. Your own phone shows a waiting screen and takes over when there's something to type (writing the Left for you question).
5. Play Tall tale, First impressions and Left for you. Between games **both** players pick **Next game** (or both pick **Again** to replay); one pick on its own just waits for the other (D29).
6. After Left for you there is one button, **Finish**: both press it, or it finishes by itself after 20 s. Both get a **stamp**, kiosk 1413 **celebrates** in the pair color, and the pair ends. Neither of you is matched again for 90 s.
7. Close on the Passport.

The three games take about 8 to 12 minutes at normal speed. Shoot them as cutaways and don't film every round.

## Things that break takes

- **No ghost riders while filming.** A ghost in your car who shares one interest with you takes your match, since the closest rider wins. See `scripts/ghost-riders.ts`.
- **Reset between takes:** `curl -X POST -H "x-kiosk-key: $KIOSK_KEY" https://husshusshuss.boston/api/demo/reset`. A take that runs past Boston College checks everyone out.
- **Use Safari or Chrome, not a home-screen web app.** On iPhone, an NFC tap opens Safari, which has separate storage from a home-screen app and wouldn't be signed in.
- **Profiles:** you and Maya need at least one shared interest. Use "Just play today" or real emails. Rehearse with the same profiles you'll film with.
- **The glasses page must stay open** for the whole ride (no notifications, D11). Wake lock is on; leave the glasses on `/g/?ride`.
- **Glasses input is still unverified.** The games on the lens take temple-strip swipes. If they don't register, play that seat on the phone and film the lens only for the match card and the stamp.

## Capture

- **Phones:** use the built-in screen recording on both and sync them in editing.
- **Kiosk and LEDs:** a handheld camera or a phone on a small gimbal.
- **Glasses HUD:** test at home first whether the glasses can record their own display. Fallback: screen-record `/g/?ride` in a 600x600 browser window, signed in as the same rider, and composite it into a lens overlay.
- **Sound:** the train is loud, so plan a voiceover.

## Rules on the train

- **Never leave hardware unattended.** A box with a Pi, an LED strip and a battery can read as a suspicious package. Keep each kiosk in someone's hands or on their lap, keep it small, and label it.
- **Permission:** the MBTA wants a permit for production filming. Handheld phone filming without a tripod, lights or crew is usually fine, but check the MBTA's current film rules before the shoot.
- Don't block doors or aisles. Keep other riders' faces out of frame, or get their OK, or blur them.

## Checklist

Before the day:
- [ ] `DEMO_LINE = "Green-B"` deployed. `curl https://husshusshuss.boston/api/health` answers, and `WORKER_URL=https://husshusshuss.boston pnpm smoke` passes.
- [ ] One full run at a table on the real devices: tap → match → glasses switch to the game → all three games → stamp + LEDs.
- [ ] Kiosk 1413 on a phone hotspot (Maximize Compatibility), reconnects after the hotspot drops for 10 s.
- [ ] NFC sticker and the 1413 tag read through the enclosure on both phones.
- [ ] One rehearsal ride on the B with no camera.

On the day:
- [ ] Power banks charged, hotspot phone plugged in, laptop on the hotspot for resets.
- [ ] `POST /api/demo/reset`, then board at Blandford St.
- [ ] Shoot each part twice.
