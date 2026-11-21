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

import logging
import os
import shutil
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

    TODO:
    - Wayland: $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY socket exists
    - X11: /tmp/.X11-unix/X0 exists
    - poll every 0.5 s up to timeout_s; return False on timeout
    (systemd ExecStartPre already does a basic version of this)
    """
    raise NotImplementedError


def launch(cfg: Config) -> NoReturn:
    """Replace this process with Chromium."""
    if not cfg.browser.enabled:
        raise SystemExit("browser.enabled = false in config.toml (screenless kiosk)")
    argv = chromium_command(cfg)
    if shutil.which(argv[0]) is None:
        raise SystemExit(f"browser binary {argv[0]!r} not found; set browser.binary in config.toml")
    log.info("launching %s for car %s", argv[0], cfg.car)
    # TODO: clear Chromium's "exited_cleanly"/"exit_type" in Preferences under
    #       --user-data-dir so a power cut doesn't show the restore bubble.
    os.execvp(argv[0], argv)
