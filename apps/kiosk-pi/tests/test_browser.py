"""Tests for the Chromium launcher helpers."""

from __future__ import annotations

import json
from pathlib import Path

from questline_kiosk.browser import clear_chromium_crash_flags, wait_for_display


def test_wait_for_display_sees_x11_socket(tmp_path: Path, monkeypatch):
    xdir = tmp_path / ".X11-unix"
    xdir.mkdir()
    (xdir / "X0").touch()
    monkeypatch.delenv("WAYLAND_DISPLAY", raising=False)
    monkeypatch.delenv("XDG_RUNTIME_DIR", raising=False)
    monkeypatch.setenv("DISPLAY", ":0")
    # Point the helper at our temp socket by patching Path for the X11 check.
    real_path = Path

    class PrefixedPath(type(real_path)):
        def __new__(cls, *args, **kwargs):
            p = real_path(*args, **kwargs)
            if str(p) == "/tmp/.X11-unix/X0":
                return xdir / "X0"
            return p

    import questline_kiosk.browser as browser_mod

    monkeypatch.setattr(browser_mod, "Path", PrefixedPath)
    assert wait_for_display(timeout_s=1.0) is True


def test_wait_for_display_times_out(monkeypatch):
    monkeypatch.delenv("WAYLAND_DISPLAY", raising=False)
    monkeypatch.delenv("XDG_RUNTIME_DIR", raising=False)
    monkeypatch.delenv("DISPLAY", raising=False)
    import questline_kiosk.browser as browser_mod

    monkeypatch.setattr(browser_mod.Path, "exists", lambda self: False)
    assert wait_for_display(timeout_s=0.6) is False


def test_clear_chromium_crash_flags(tmp_path: Path):
    prefs = tmp_path / "Default" / "Preferences"
    prefs.parent.mkdir(parents=True)
    prefs.write_text(
        json.dumps({"profile": {"exited_cleanly": False, "exit_type": "Crashed"}, "other": 1}),
        encoding="utf-8",
    )
    clear_chromium_crash_flags(tmp_path)
    data = json.loads(prefs.read_text(encoding="utf-8"))
    assert data["profile"]["exited_cleanly"] is True
    assert data["profile"]["exit_type"] == "Normal"
    assert data["other"] == 1


def test_clear_chromium_crash_flags_missing_file(tmp_path: Path):
    clear_chromium_crash_flags(tmp_path)  # no Preferences — no-op
