# this-town (Questline)

Questline turns your ride on the T into a quick game with the right stranger. Turn on Ride Mode, and you get matched with the closest rider on your train who shares your interests. Your Meta Ray-Ban Display glasses tell you who and where to go, the kiosk in the train car glows your pair's color and runs a short mission, and you both tap the kiosk to collect a stamp before the next stop.

**The phone decides who. The glasses and the kiosk make it happen.**

## How it works

1. **Onboard once** on your phone: first name, 3 to 5 interests, social battery. Link your glasses with a 4-digit code.
2. **Board and tap** the NFC tag on the car's kiosk. That checks you into the car and turns on Ride Mode.
3. **Get matched** with the closest rider on the same train with shared interests. No accept step: Ride Mode is the consent. One pinch on the glasses for "Not now".
4. **Meet at the kiosk.** The glasses say where ("kiosk 1 car back, look for orange") and the kiosk LEDs light up.
5. **Play** a short mission on the kiosk screen that ends before the next stop.
6. **Tap to stamp.** Both tap the kiosk tag (fresh code each mission) and confirm.

## Repo layout

```
apps/
  worker/        Cloudflare Worker: Hono API, D1, TrainRoom Durable Objects, serves the web apps
  phone-web/     Rider phone app (onboarding, Ride Mode, NFC landing, passport)
  glasses-web/   Meta Ray-Ban Display Web App (600x600 HUD)
  kiosk-web/     Kiosk touchscreen UI (runs in Chromium kiosk mode on the Pi)
  kiosk-pi/      Python agent on the Pi (LED strip, dynamic NFC tag)
packages/
  protocol/      Shared types and zod schemas for REST + WebSocket events
scripts/         Seed data, ghost riders, asset build
docs/            Architecture, decisions, hardware, demo script
```

## Quick start

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

- Phone: http://localhost:5173
- Glasses: http://localhost:5174/g/ (resize the window to 600x600)
- Kiosk: http://localhost:5175/kiosk/1412
- Worker: http://localhost:8787

Each app's README has details. The Pi setup is in `apps/kiosk-pi/README.md` and `docs/hardware.md`.

## Docs

- [Architecture](docs/architecture.md)
- [Decisions](docs/decisions.md)
- [Hardware](docs/hardware.md)
- [Demo script](docs/demo-script.md)
- [v1 spec (archived, outdated)](docs/archive/questline-spec-v1.md)

## Stack

TypeScript, React + Vite, Hono on Cloudflare Workers, D1, Durable Objects, MBTA V3 API, Claude API. Python on the Raspberry Pi.
