# Kiosk hardware

One kiosk per train car: Raspberry Pi, 7" touchscreen, WS2812B LED strip, dynamic NFC tag, battery. Software is `apps/kiosk-pi` (agent) and `apps/kiosk-web` (screen). Architecture context: `docs/architecture.md` ("Hardware", "Location: NFC tap").

All prices are **approximate** (USD, late 2026, single units, before shipping). Check current listings before ordering.

## Bill of materials (per kiosk)

| Part | Notes | Approx. price |
|---|---|---|
| Raspberry Pi 4 (4 GB) or Pi 5 (4 GB) | Pi 4 is simpler for the LED driver (GPIO18 PWM). Pi 5 must use the SPI LED driver. 2 GB is enough for Chromium on one page. | $55 to $80 |
| microSD card, 32 GB, A1/A2 | Raspberry Pi OS Bookworm 64-bit, desktop | $10 |
| Official 7" touchscreen (Touch Display 2, 720x1280) | DSI ribbon, powered from GPIO 5V/GND (pins 4 and 6). The older 800x480 7" display also works. | $60 |
| WS2812B strip, 1 m, 30 LEDs/m, 5 V | ~30 LEDs. Worst case 60 mA each at full white (1.8 A). | $8 to $12 |
| 74AHCT125 quad level shifter (DIP) | 3.3 V Pi data to 5 V strip data. Adafruit #1787 or any 74AHCT125. | $2 |
| 330 ohm resistor + 1000 uF / 10 V capacitor | Resistor in series on DIN, cap across strip 5 V/GND | $1 |
| Dynamic NFC tag, one of: | | |
| - ST25DV16K breakout (Adafruit #4701, STEMMA QT, onboard antenna) | Easiest to get. I2C 0x53 (user) + 0x57 (system). `nfc.chip = "st25dv"` | $10 |
| - SparkFun Qwiic Dynamic NFC/RFID Tag (ST25DV64KC) | Same driver family. | $15 |
| - NTAG I2C plus board (NXP NT3H2111/NT3H2211, e.g. MikroE NFC Tag 2 Click) | I2C 0x55. `nfc.chip = "ntag_i2c_plus"` | $20 to $30 |
| NTAG215 stickers, 10 pack | Static fallback (`https://<domain>/k/<car>`), 504 bytes user memory. Get "on-metal" stickers if mounting on metal. | $8 |
| Power bank, 20,000 mAh, 2 USB outputs, 5 V / 3 A each | One port for the Pi (USB-C), one for the LED strip (USB pigtail). PD 15 W+ per port. | $30 to $50 |
| USB-C cable for the Pi + USB-A/C to bare-wire pigtail for the strip | | $8 |
| Jumper wires, small breadboard or perfboard, JST-SM 3-pin connector | | $8 |
| Enclosure | SmartiPi Touch 2 / Pi display case, or foam board with a thin acrylic window over the tag | $10 to $35 |
| Wall PSU for bench testing (Pi 4: 5 V 3 A USB-C; Pi 5: 27 W official) | Not needed on the train | $8 to $12 |

**Full kiosk:** roughly $190 to $260. **Lite kiosk** (Pi + LEDs + tag, no screen, no case): roughly $90 to $130. A static sticker alone is under $1 but has no LEDs and no fresh nonce.

## Wiring

Pi header pin numbers are physical pins. GPIO numbers are BCM.

### LED strip (WS2812B)

| From | To | Notes |
|---|---|---|
| Pi GPIO18, pin 12 | 74AHCT125 1A, pin 2 | PWM0. Pi 4 with `leds.driver = "ws281x"`. |
| 74AHCT125 1Y, pin 3 | 330 ohm resistor -> strip DIN | Resistor close to the strip |
| 74AHCT125 1OE, pin 1 | GND | Active low: tie to GND to enable channel 1 |
| 74AHCT125 VCC, pin 14 | 5 V (Pi pin 2, or the LED supply) | Must be 5 V so the output swings to 5 V |
| 74AHCT125 GND, pin 7 | GND | |
| 74AHCT125 2OE/3OE/4OE (pins 4, 10, 13) | 5 V | Disables unused channels. Tie unused inputs (5, 9, 12) to GND. |
| Strip 5 V | Power bank port 2 (USB pigtail red) | Not from the Pi's 5 V pin |
| Strip GND | Power bank port 2 GND **and** Pi GND (pin 14) | Common ground is required or the data line won't work |
| 1000 uF capacitor | Across strip 5 V and GND, at the strip end | Watch polarity |

**Alternative data pin, GPIO10 (pin 19, SPI0 MOSI):** use with `leds.driver = "neopixel_spi"`. Required on **Pi 5** (rpi_ws281x does not support the Pi 5's RP1 chip). Also works on Pi 4 without root; set `core_freq=500` and `core_freq_min=500` in `/boot/firmware/config.txt`. Same level shifter, just a different input pin.

**GPIO18 caveats (Pi 4):** PWM uses `/dev/mem`, so the agent must run as root (`sudo systemctl edit questline-agent` -> `User=root`), and analog audio must be off (`dtparam=audio=off`).

### NFC tag (I2C)

| From | To | Notes |
|---|---|---|
| Pi 3V3, pin 1 | Breakout VCC / 3V3 | **3.3 V only.** Do not use 5 V. |
| Pi GPIO2 SDA, pin 3 | SDA | Pi has 1.8 k pull-ups on SDA/SCL already |
| Pi GPIO3 SCL, pin 5 | SCL | |
| Pi GND, pin 9 | GND | |
| (optional) breakout FD / GPO | Pi GPIO17, pin 11 | Field detect: lets the agent see a phone in the field. Not used yet. |

STEMMA QT / Qwiic boards: use a STEMMA QT to female jumper cable (red 3V3, black GND, blue SDA, yellow SCL). Check with `i2cdetect -y 1`: `55` for NTAG I2C plus, `53` and `57` for ST25DV (some boards also show `2d`).

### Power

- Power bank port 1 -> Pi USB-C. Port 2 -> LED strip via pigtail. Touchscreen runs from the Pi's GPIO 5V/GND (pins 4 and 6) with its included cable.
- Budget at 5 V: Pi 4 0.6 to 1.3 A, display ~0.5 A, LEDs ~0.3 to 0.7 A at `brightness = 0.4` (1.8 A worst case at full white). Keep `brightness` at or under 0.5.
- Pi 5 asks for 5 V / 5 A. On a 3 A power bank it boots, warns, and limits USB current. That is fine here (no USB devices).
- If the Pi shows the lightning bolt or reboots when LEDs go bright, lower `leds.brightness` or move the strip to its own port.
- Everything shares one ground: Pi GND, shifter GND, strip GND, power bank GND.

## NFC notes

- **iPhone XS and newer** read tags in the background with no app, as long as the tag holds an **NDEF URI record** (`https://...`). The screen must be on (the lock screen is fine) and the phone must have been unlocked once since boot. Background reading does not work while the camera, Wallet/Apple Pay or another NFC session is in use, or in airplane mode. iPhone 7 to X need the NFC control center button.
- **Android:** NFC on, screen unlocked. The link opens in the default browser.
- **Keep the URL short.** `https://<short-domain>/k/1412?n=<8 to 12 chars>` is well under 100 bytes. Short URLs read faster and fit any tag (NTAG215: 504 bytes). The `https://` prefix is compressed to one byte by the NDEF builder.
- **Dynamic tags** are rewritten per mission. Never lock them read-only. If a phone is in the field during a write the chip may NAK (RF/I2C arbitration); the agent retries.
- **Static stickers:** write with NXP TagWriter or NFC Tools (`scripts/write_static_tag.py` prints the URL and steps). Locking is optional and permanent.
- **Placement:** antenna facing out, behind at most ~3 to 5 mm of plastic or acrylic, nothing metal behind it (metal detunes the antenna; use on-metal stickers on metal surfaces). Chest height, away from the strip's power wires.
- **Tap marker:** print a "Tap here" label with the NFC logo and the car number right over the antenna. Riders aim for the label, so put it exactly over the coil.

## Network

- Each kiosk joins a **phone hotspot**. Only outbound HTTPS/WSS on port 443 is needed.
- iPhone hotspot: turn on **Maximize Compatibility** (2.4 GHz). Use a teammate's phone that is not part of the demo, and keep it plugged in.
- Add the hotspot on the Pi (Bookworm uses NetworkManager):
  ```bash
  sudo nmcli dev wifi connect "<SSID>" password "<password>"
  sudo nmcli connection modify "<SSID>" connection.autoconnect-priority 10 802-11-wireless.powersave 2
  ```
  Add a second hotspot as backup with a lower priority.
- Wi-Fi power save off (`powersave 2` above) keeps the socket from dropping when idle.

## Demo setup

From `docs/demo-script.md`: two kiosks on the table, labeled **car 1412** and **car 1413**.

- In the script you board at **1412**, Maya is in **1413**, she stays put and you walk to her, so the **mission screen is 1413's**. Make **1413 the full kiosk** (screen + LEDs + dynamic tag).
- **1412** can be the lite kiosk: Pi with LEDs + tag and no screen (`SKIP_BROWSER=1 ./scripts/setup.sh`, `browser.enabled = false`), or a static sticker only if hardware runs short. The demo-script setup line says "the second can be a Pi with no screen"; read that as 1412, not 1413.
- Each kiosk gets its own `config.toml` with its `car`. Same `domain` and `kiosk_key`.
- Print a big car number label for each kiosk so the audience can follow "1 car forward".
- `DEMO_CAR_TRIPS` in `apps/worker/wrangler.toml` must map both 1412 and 1413 to the demo trip.

## Pre-event checklist

Software already verified on a laptop (`--fake`, pytest for NDEF / LED event mapping / NFC writers / browser helpers). Everything below still needs a real Pi + strip + tag.

Night before:
- [ ] Both SD cards flashed, `setup.sh` run, `config.toml` filled in (car 1412 / 1413, domain, kiosk_key).
- [ ] `python -m questline_kiosk urls` shows the right domain and car on each Pi.
- [ ] `i2cdetect -y 1` sees the NFC chip on each Pi.
- [ ] `scripts/led_test.py` runs clean on each strip (all pixels light, colors right, no flicker). Real WS281x / SPI drivers are implemented; this is the first hardware proof.
- [ ] Tag reads from an iPhone and an Android phone through the enclosure, screen locked, background read banner opens the right URL. Dynamic writers verify read-back over I2C; phone RF read is still a hardware check.
- [ ] Static NTAG215 stickers written for both cars and tested (fallback).
- [ ] Power banks charged, plus spares. Cables and pigtails packed.
- [ ] Hotspot SSID/password saved on both Pis, with a backup hotspot.

At the venue:
- [ ] Hotspot on (Maximize Compatibility), Pis connected (`nmcli dev status`).
- [ ] `journalctl -u questline-agent -f` shows connected + `kiosk.hello` on both.
- [ ] Kiosk screen loads on 1413, idle stats tick up with `pnpm ghosts` running.
- [ ] Dry run of the full demo script once: tap, match, LEDs glow, mission, tag rewrite, stamp, celebrate.
- [ ] Unplug the hotspot for 10 s and check both kiosks reconnect on their own.
- [ ] LED brightness comfortable for the room (`leds.brightness`), no power-bank brownouts.
- [ ] "Tap here" markers stuck over the antennas.
