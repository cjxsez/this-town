"""Load and validate the agent's TOML config.

Reads ``config.toml`` (see ``config.example.toml``) with the stdlib ``tomllib``
and turns it into frozen dataclasses. Validation is strict on purpose: a typo
in the car id or key should fail at boot with a clear message, not as a silent
WebSocket 401 in a moving train.

Also derives the URLs the rest of the agent needs:
    ws_url          wss://<domain>/ws/kiosk/<car>?key=<key>&role=pi
    kiosk_page_url  https://<domain>/kiosk/<car>?key=<key>
    static_tag_url  https://<domain>/k/<car>          (static sticker fallback)
"""

from __future__ import annotations

import dataclasses
import logging
import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, get_args
from urllib.parse import quote, urlencode

log = logging.getLogger(__name__)

NfcMode = Literal["dynamic", "static", "none"]
NfcChip = Literal["ntag_i2c_plus", "st25dv", "fake"]
LedDriver = Literal["ws281x", "neopixel_spi", "fake"]

# Mirrors CarId in packages/protocol/src/models.ts.
CAR_ID_RE = re.compile(r"^[A-Za-z0-9-]{1,12}$")
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
# GPIOs rpi_ws281x can drive: PWM0 (12, 18), PWM1 (13, 19), PCM (21), SPI (10).
WS281X_PINS = frozenset({10, 12, 13, 18, 19, 21})
PLACEHOLDER_KEYS = frozenset({"", "change-me"})


class ConfigError(ValueError):
    """Config file is missing, unreadable or invalid."""


@dataclass(frozen=True)
class LedConfig:
    enabled: bool = True
    driver: LedDriver = "ws281x"
    pin: int = 18
    count: int = 30
    brightness: float = 0.4
    order: str = "GRB"
    idle_color: str = "#8fb4ff"


@dataclass(frozen=True)
class NfcConfig:
    mode: NfcMode = "dynamic"
    chip: NfcChip = "ntag_i2c_plus"
    i2c_bus: int = 1
    i2c_address: int = 0x55
    write_retries: int = 3


@dataclass(frozen=True)
class AgentConfig:
    ping_interval_s: float = 20.0
    reconnect_min_s: float = 1.0
    reconnect_max_s: float = 30.0
    celebrate_s: float = 4.0
    log_level: str = "INFO"


@dataclass(frozen=True)
class BrowserConfig:
    enabled: bool = True
    binary: str = "chromium-browser"
    flags: tuple[str, ...] = ("--kiosk",)


@dataclass(frozen=True)
class Config:
    domain: str
    car: str
    kiosk_key: str
    tls: bool = True
    leds: LedConfig = field(default_factory=LedConfig)
    nfc: NfcConfig = field(default_factory=NfcConfig)
    agent: AgentConfig = field(default_factory=AgentConfig)
    browser: BrowserConfig = field(default_factory=BrowserConfig)

    @property
    def ws_url(self) -> str:
        scheme = "wss" if self.tls else "ws"
        q = urlencode({"key": self.kiosk_key, "role": "pi"})
        return f"{scheme}://{self.domain}/ws/kiosk/{quote(self.car)}?{q}"

    @property
    def kiosk_page_url(self) -> str:
        scheme = "https" if self.tls else "http"
        q = urlencode({"key": self.kiosk_key})
        return f"{scheme}://{self.domain}/kiosk/{quote(self.car)}?{q}"

    @property
    def static_tag_url(self) -> str:
        scheme = "https" if self.tls else "http"
        return f"{scheme}://{self.domain}/k/{quote(self.car)}"


def _section(data: dict[str, Any], name: str) -> dict[str, Any]:
    value = data.get(name, {})
    if not isinstance(value, dict):
        raise ConfigError(f"[{name}] must be a table")
    return value


def _build(cls: type, raw: dict[str, Any], section: str) -> Any:
    """Construct a section dataclass, rejecting unknown keys (catches typos)."""
    known = {f.name for f in dataclasses.fields(cls)}
    unknown = set(raw) - known
    if unknown:
        raise ConfigError(f"[{section}] unknown keys: {', '.join(sorted(unknown))}")
    try:
        return cls(**raw)
    except TypeError as e:  # pragma: no cover - defensive
        raise ConfigError(f"[{section}] {e}") from e


def validate(cfg: Config) -> Config:
    """Check every field. Returns cfg unchanged or raises ConfigError."""
    errors: list[str] = []

    if not cfg.domain or "://" in cfg.domain or "/" in cfg.domain:
        errors.append("domain must be a bare host like 'questline.example.com' (no scheme, no path)")
    if not CAR_ID_RE.match(cfg.car):
        errors.append(f"car {cfg.car!r} must match {CAR_ID_RE.pattern} (MBTA carriage label)")
    if cfg.kiosk_key in PLACEHOLDER_KEYS:
        errors.append("kiosk_key is empty or still 'change-me'")

    leds = cfg.leds
    if leds.driver not in get_args(LedDriver):
        errors.append(f"leds.driver must be one of {get_args(LedDriver)}")
    if leds.driver == "ws281x" and leds.pin not in WS281X_PINS:
        errors.append(f"leds.pin {leds.pin} is not a ws281x-capable GPIO {sorted(WS281X_PINS)}")
    if not 1 <= leds.count <= 300:
        errors.append("leds.count must be 1..300")
    if not 0.0 <= leds.brightness <= 1.0:
        errors.append("leds.brightness must be 0.0..1.0")
    if sorted(leds.order.upper()) not in (sorted("RGB"), sorted("RGBW")):
        errors.append("leds.order must be a permutation of RGB or RGBW")
    if not HEX_COLOR_RE.match(leds.idle_color):
        errors.append("leds.idle_color must be #rrggbb")

    nfc = cfg.nfc
    if nfc.mode not in get_args(NfcMode):
        errors.append(f"nfc.mode must be one of {get_args(NfcMode)}")
    if nfc.chip not in get_args(NfcChip):
        errors.append(f"nfc.chip must be one of {get_args(NfcChip)}")
    if not 0x03 <= nfc.i2c_address <= 0x77:
        errors.append("nfc.i2c_address must be a 7-bit address 0x03..0x77")
    if nfc.write_retries < 0:
        errors.append("nfc.write_retries must be >= 0")

    a = cfg.agent
    if a.ping_interval_s < 5:
        errors.append("agent.ping_interval_s must be >= 5")
    if not 0 < a.reconnect_min_s <= a.reconnect_max_s:
        errors.append("agent.reconnect_min_s must be > 0 and <= reconnect_max_s")
    if a.log_level.upper() not in logging.getLevelNamesMapping():
        errors.append(f"agent.log_level {a.log_level!r} is not a logging level")

    if cfg.browser.enabled and not cfg.browser.binary:
        errors.append("browser.binary is required when browser.enabled = true")

    if errors:
        raise ConfigError("invalid config:\n  - " + "\n  - ".join(errors))
    return cfg


def load_config(path: str | Path) -> Config:
    """Read and validate a TOML config file."""
    p = Path(path)
    try:
        data = tomllib.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError as e:
        raise ConfigError(f"{p} not found (copy config.example.toml to config.toml)") from e
    except tomllib.TOMLDecodeError as e:
        raise ConfigError(f"{p}: {e}") from e

    top_keys = {"domain", "car", "kiosk_key", "tls", "leds", "nfc", "agent", "browser"}
    unknown = set(data) - top_keys
    if unknown:
        raise ConfigError(f"unknown top-level keys: {', '.join(sorted(unknown))}")
    for required in ("domain", "car", "kiosk_key"):
        if required not in data:
            raise ConfigError(f"missing required key: {required}")

    browser_raw = dict(_section(data, "browser"))
    if "flags" in browser_raw:
        browser_raw["flags"] = tuple(str(f) for f in browser_raw["flags"])

    cfg = Config(
        domain=str(data["domain"]),
        car=str(data["car"]),
        kiosk_key=str(data["kiosk_key"]),
        tls=bool(data.get("tls", True)),
        leds=_build(LedConfig, _section(data, "leds"), "leds"),
        nfc=_build(NfcConfig, _section(data, "nfc"), "nfc"),
        agent=_build(AgentConfig, _section(data, "agent"), "agent"),
        browser=_build(BrowserConfig, browser_raw, "browser"),
    )
    return validate(cfg)


def with_fake_hardware(cfg: Config) -> Config:
    """Swap in FakeLeds and FakeTag (``--fake`` on a laptop). NFC reports as dynamic."""
    return dataclasses.replace(
        cfg,
        leds=dataclasses.replace(cfg.leds, enabled=True, driver="fake"),
        nfc=dataclasses.replace(cfg.nfc, mode="dynamic", chip="fake"),
    )
