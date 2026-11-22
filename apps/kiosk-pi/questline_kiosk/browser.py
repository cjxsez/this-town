"""Launch Chromium in kiosk mode on the touchscreen.

Opens ``https://<domain>/kiosk/<car>?key=<kiosk_key>`` (apps/kiosk-web). The
screen holds its own WebSocket (role=screen); this module only starts the
browser. It runs as its own systemd unit (systemd/questline-browser.service)
via ``python -m questline_kiosk browser`` so a browser crash never restarts
the LED/NFC agent and vice versa.

The process execs into Chromium, so systemd supervises Chromium directly and
``Restart=always`` brings it back if it dies.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import time
from pathlib import Path
from typing import NoReturn

from .config import Config

log = logging.getLogger(__name__)


def kiosk_page_url(cfg: Config) -> str:
    return cfg.kiosk_page_url


def chromium_command(cfg: Config) -> list[str]:
    """argv for Chromium: binary, configured flags, then the kiosk URL."""
    return [cfg.browser.binary, *cfg.browser.flags, kiosk_page_url(cfg)]


def wait_for_display(timeout_s: float = 60.0) -> bool:
    """Block until a Wayland or X display is available.

    Wayland: ``$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY`` socket exists.
    X11: ``/tmp/.X11-unix/X0`` exists.
    Polls every 0.5 s up to ``timeout_s``; returns False on timeout.
    """
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        wayland = os.environ.get("WAYLAND_DISPLAY")
        runtime = os.environ.get("XDG_RUNTIME_DIR", "")
        if wayland and runtime and Path(runtime, wayland).exists():
            return True
        if Path("/tmp/.X11-unix/X0").exists():
            return True
        # Also accept $DISPLAY pointing at a real X socket (:0 -> X0, :1 -> X1).
        display = os.environ.get("DISPLAY", "")
        if display.startswith(":"):
            num = display[1:].split(".")[0]
            if num.isdigit() and Path(f"/tmp/.X11-unix/X{num}").exists():
                return True
        time.sleep(0.5)
    return False


def _user_data_dir_from_flags(flags: tuple[str, ...]) -> Path | None:
    for i, flag in enumerate(flags):
        if flag.startswith("--user-data-dir="):
            return Path(flag.split("=", 1)[1])
        if flag == "--user-data-dir" and i + 1 < len(flags):
            return Path(flags[i + 1])
    return None


def clear_chromium_crash_flags(user_data_dir: Path) -> None:
    """Mark the last Chromium exit as clean so the restore-pages bubble stays gone."""
    prefs_path = user_data_dir / "Default" / "Preferences"
    if not prefs_path.is_file():
        return
    try:
        data = json.loads(prefs_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        log.warning("could not read Chromium preferences at %s: %s", prefs_path, e)
        return

    profile = data.setdefault("profile", {})
    profile["exited_cleanly"] = True
    profile["exit_type"] = "Normal"
    try:
        prefs_path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        log.info("cleared Chromium crash flags in %s", prefs_path)
    except OSError as e:
        log.warning("could not write Chromium preferences at %s: %s", prefs_path, e)


def launch(cfg: Config) -> NoReturn:
    """Replace this process with Chromium."""
    if not cfg.browser.enabled:
        raise SystemExit("browser.enabled = false in config.toml (screenless kiosk)")
    if not wait_for_display():
        raise SystemExit("no X/Wayland display found; is the desktop running?")
    user_data = _user_data_dir_from_flags(cfg.browser.flags)
    if user_data is not None:
        clear_chromium_crash_flags(user_data)
    argv = chromium_command(cfg)
    if shutil.which(argv[0]) is None:
        raise SystemExit(f"browser binary {argv[0]!r} not found; set browser.binary in config.toml")
    log.info("launching %s for car %s", argv[0], cfg.car)
    os.execvp(argv[0], argv)
