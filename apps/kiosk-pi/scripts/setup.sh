#!/usr/bin/env bash
# One-time Pi setup for the Questline kiosk agent.
#
# Run on the Pi as user pi (uses sudo where needed), from anywhere:
#   ./apps/kiosk-pi/scripts/setup.sh
# Options (env vars):
#   SKIP_BROWSER=1   screenless kiosk (tag + LEDs only): don't install Chromium or its service
#   SKIP_APT=1       skip apt-get (re-runs)
#
# What it does:
#   1. apt packages (python venv + build tools for rpi_ws281x, i2c-tools, chromium)
#   2. enables I2C and SPI, desktop autologin, no screen blanking (raspi-config)
#   3. adds the user to gpio, i2c, spi groups
#   4. creates .venv and installs the agent
#   5. copies config.example.toml -> config.toml (if missing)
#   6. installs and enables the systemd units
# It does not start anything: edit config.toml, reboot, then check the logs.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${SUDO_USER:-$USER}"
DEFAULT_APP_DIR="/home/pi/this-town/apps/kiosk-pi"

echo "==> kiosk-pi at $APP_DIR (user $RUN_USER)"

# ---------- 1. apt ----------
if [[ "${SKIP_APT:-0}" != "1" ]]; then
  pkgs=(python3-venv python3-dev python3-pip build-essential git i2c-tools)
  if [[ "${SKIP_BROWSER:-0}" != "1" ]]; then
    # Bookworm ships chromium-browser; Trixie and later ship chromium.
    if apt-cache show chromium-browser >/dev/null 2>&1; then pkgs+=(chromium-browser); else pkgs+=(chromium); fi
  fi
  sudo apt-get update
  sudo apt-get install -y "${pkgs[@]}"
fi

# ---------- 2. interfaces ----------
if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_i2c 0        # 0 = enable
  sudo raspi-config nonint do_spi 0        # SPI LED driver (GPIO10)
  sudo raspi-config nonint do_blanking 1   # 1 = disable screen blanking
  if [[ "${SKIP_BROWSER:-0}" != "1" ]]; then
    sudo raspi-config nonint do_boot_behaviour B4   # desktop, autologin
  fi
else
  echo "!! raspi-config not found. Enable I2C and SPI by hand:"
  echo "   add dtparam=i2c_arm=on and dtparam=spi=on to /boot/firmware/config.txt"
fi

cat <<'NOTE'
!! LED driver notes (see docs/hardware.md):
   - Pi 4 + ws281x on GPIO18 (PWM): add dtparam=audio=off to /boot/firmware/config.txt,
     and the agent needs root (systemctl edit questline-agent -> User=root).
   - Pi 4 + SPI (GPIO10): add core_freq=500 and core_freq_min=500 to config.txt.
   - Pi 5: use leds.driver = "neopixel_spi" on GPIO10. rpi_ws281x does not support Pi 5.
NOTE

# ---------- 3. groups ----------
for g in gpio i2c spi; do
  if getent group "$g" >/dev/null; then sudo usermod -aG "$g" "$RUN_USER"; fi
done

# ---------- 4. venv ----------
cd "$APP_DIR"
if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt -e .

# ---------- 5. config ----------
if [[ ! -f config.toml ]]; then
  cp config.example.toml config.toml
  chmod 600 config.toml
  echo "==> created config.toml. Set domain, car and kiosk_key before rebooting."
fi
if [[ "$RUN_USER" != "pi" ]]; then
  sed -i "s#/home/pi/.config#/home/${RUN_USER}/.config#g" config.toml
fi
if [[ "${SKIP_BROWSER:-0}" == "1" ]]; then
  # Turn off [browser] enabled for a screenless kiosk.
  sed -i '/^\[browser\]/,/^\[/ s/^enabled = true/enabled = false/' config.toml
fi

# ---------- 6. systemd ----------
install_unit() {
  local name="$1"
  sed -e "s#${DEFAULT_APP_DIR}#${APP_DIR}#g" \
      -e "s#/run/user/1000#/run/user/$(id -u "$RUN_USER")#g" \
      -e "s#^User=pi#User=${RUN_USER}#" -e "s#^Group=pi#Group=${RUN_USER}#" \
      "systemd/${name}" | sudo tee "/etc/systemd/system/${name}" >/dev/null
  echo "==> installed /etc/systemd/system/${name}"
}
install_unit questline-agent.service
if [[ "${SKIP_BROWSER:-0}" != "1" ]]; then install_unit questline-browser.service; fi

sudo systemctl daemon-reload
sudo systemctl enable questline-agent.service
if [[ "${SKIP_BROWSER:-0}" != "1" ]]; then sudo systemctl enable questline-browser.service; fi

cat <<EOF

Done. Next:
  1. edit $APP_DIR/config.toml (domain, car, kiosk_key, leds.driver, nfc.chip)
  2. check the NFC chip shows up: i2cdetect -y 1   (0x55 NTAG I2C plus, 0x53/0x57 ST25DV)
  3. sudo reboot
  4. journalctl -u questline-agent -f
EOF
