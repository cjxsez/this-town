# kiosk-pi

Python agent for the Raspberry Pi in each train car. Status: **ready for Pi bring-up**. Socket loop, LED animations, WS281x / SPI drivers, dynamic NTAG I2C + ST25DV writers (with read-back verify), and the Chromium launcher all work. Use `--fake` on a laptop; wire real hardware on the Pi.

## What the Pi does

- Holds one outbound WebSocket to the car's TrainRoom: `wss://<domain>/ws/kiosk/<car>?key=<KIOSK_KEY>&role=pi`. Sends `kiosk.hello`, pings, reconnects with backoff.
- Drives the WS2812 LED strip from kiosk events: pair color on `pair.incoming`, slow pulse on `mission.show`, burst (rainbow if rare) on `celebrate`, dim idle on `pair.cleared` / `kiosk.idle`.
- Rewrites the dynamic NFC tag on `nfc.write` and replies `nfc.written {url}`.
- Launches Chromium in kiosk mode on `https://<domain>/kiosk/<car>?key=...` (`apps/kiosk-web`).

Event details: [protocol.md](protocol.md). Hardware and wiring: [docs/hardware.md](../../docs/hardware.md).

## File map

```
apps/kiosk-pi/
  pyproject.toml            package + deps (extras: pi, dev)
  requirements.txt          what setup.sh installs on the Pi
  config.example.toml       copy to config.toml (gitignored)
  protocol.md               kiosk events, mirrors packages/protocol
  questline_kiosk/
    __main__.py             python -m questline_kiosk [agent|browser|urls]
    config.py               load + validate config.toml, derive URLs
    protocol.py             TypedDicts for kiosk events, PAIR_COLOR_HEX, parse/encode
    agent.py                asyncio loop: connect, hello, ping, dispatch, reconnect
    leds.py                 LedStrip + Ws281xStrip, NeopixelSpiStrip, FakeLeds, NullLeds
    animations.py           idle, solid, pulse, burst, rainbow + AnimationPlayer
    nfc_tag.py              NDEF URI builder, NfcTag + DynamicNtagI2C, DynamicSt25dv, StaticTag, FakeTag
    browser.py              Chromium kiosk launcher
  systemd/
    questline-agent.service
    questline-browser.service
  scripts/
    setup.sh                one-time Pi setup
    write_static_tag.py     put /k/<car> on an NTAG215 sticker (phone) or the dynamic tag
    led_test.py             LED smoke test
  tests/
    test_ndef.py            NDEF builder tests
```

## Local dev (laptop)

No Pi needed. `--fake` swaps in `FakeLeds` (prints colored blocks) and `FakeTag` (prints writes, reports as a dynamic tag).

```bash
cd apps/kiosk-pi
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp config.example.toml config.toml
# set: domain = "localhost:8787", tls = false, car = "1412", kiosk_key = <KIOSK_KEY from apps/worker/.dev.vars>
pnpm dev                                    # from the repo root, in another terminal
python -m questline_kiosk urls              # check the URLs (key masked)
python -m questline_kiosk --fake            # run the agent
python scripts/led_test.py --fake           # preview animations
pytest                                      # NDEF, LED mapping, NFC writers, browser helpers
```

## Deploy to a Pi

Raspberry Pi OS Bookworm (64-bit, desktop), user `pi`, repo cloned at `/home/pi/this-town` (other paths work; setup.sh rewrites the units).

```bash
git clone <repo> ~/this-town
cd ~/this-town/apps/kiosk-pi
./scripts/setup.sh                # screenless kiosk: SKIP_BROWSER=1 ./scripts/setup.sh
nano config.toml                  # domain, car, kiosk_key, leds.driver, nfc.chip
i2cdetect -y 1                    # NFC chip: 0x55 (NTAG I2C plus) or 0x53/0x57 (ST25DV)
sudo .venv/bin/python scripts/led_test.py --config config.toml
sudo reboot
journalctl -u questline-agent -f
journalctl -u questline-browser -f
```

LED driver choice:
- **Pi 4, GPIO18 (PWM):** `driver = "ws281x"`, `pin = 18`. Needs root (`sudo systemctl edit questline-agent`, set `User=root`) and `dtparam=audio=off`.
- **Pi 5, or Pi 4 without root:** `driver = "neopixel_spi"`, data on GPIO10. On Pi 4 also set `core_freq=500` and `core_freq_min=500`.

## Wiring summary

- LED data: Pi GPIO18 (pin 12) -> 74AHCT125 -> 330 ohm -> strip DIN. Strip powered from the 5 V supply, not the Pi.
- NFC tag: 3V3 (pin 1), SDA GPIO2 (pin 3), SCL GPIO3 (pin 5), GND (pin 9).
- One common ground for Pi, level shifter, strip and supply.

Full table, BOM and the pre-event checklist: [docs/hardware.md](../../docs/hardware.md).
