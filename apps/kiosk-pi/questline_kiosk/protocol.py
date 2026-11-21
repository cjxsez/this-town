"""Kiosk WebSocket messages, mirrored from packages/protocol.

Source of truth: ``packages/protocol/src/events.ts`` (ServerToKiosk,
KioskToServer) and ``packages/protocol/src/models.ts`` (PairColor,
PAIR_COLOR_HEX, Mission, CarId). This module is a hand-written Python mirror.
When those files change, update this module AND ``apps/kiosk-pi/protocol.md``
in the same PR.

Messages are JSON objects ``{ "type": ..., ...payload }``. The Pi only cares
about a few fields of each event, but the TypedDicts list every field so they
stay easy to diff against the zod schemas.

Validation here is deliberately light (known type + required keys + valid
color). The Worker already validates with zod before sending; this just keeps
a malformed message from crashing the agent.
"""

from __future__ import annotations

import json
from typing import Final, Literal, NotRequired, TypedDict, Union, get_args

# ---------- models.ts ----------

PairColor = Literal["orange", "green", "blue", "pink", "yellow", "purple"]

PAIR_COLOR_HEX: Final[dict[PairColor, str]] = {
    "orange": "#ff8a00",
    "green": "#22c55e",
    "blue": "#3b82f6",
    "pink": "#ec4899",
    "yellow": "#facc15",
    "purple": "#a855f7",
}

MissionCategory = Literal["create", "show-me", "spot", "quick-game", "late-bonus"]
NfcMode = Literal["dynamic", "static", "none"]
KioskRole = Literal["screen", "pi"]


class Mission(TypedDict):
    sessionId: str
    templateId: str
    category: MissionCategory
    title: str
    prompt: str
    endsAt: int  # epoch ms
    rare: bool


# ---------- server -> kiosk ----------


class KioskIdleEvent(TypedDict):
    type: Literal["kiosk.idle"]
    ridersInCar: int
    ridersOnTrain: int
    nextStop: str | None
    nextStopEtaSec: int | None
    serverNow: int  # epoch ms


class PairIncomingEvent(TypedDict):
    type: Literal["pair.incoming"]
    matchId: str
    color: PairColor
    firstNames: list[str]  # zod tuple [string, string]; first names only, screen is public
    arrived: int  # 0-2 riders who said "I'm here"


class MissionShowEvent(TypedDict):
    type: Literal["mission.show"]
    matchId: str
    color: PairColor
    mission: Mission
    serverNow: int  # epoch ms


class StampProgressEvent(TypedDict):
    type: Literal["stamp.progress"]
    matchId: str
    tapped: int  # 1 or 2


class NfcWriteEvent(TypedDict):
    """Pi only: write this URL to the NFC tag now, reply nfc.written / nfc.failed with the same writeId."""

    type: Literal["nfc.write"]
    writeId: str
    url: str


class CelebrateEvent(TypedDict):
    type: Literal["celebrate"]
    matchId: str
    color: PairColor
    rare: bool


class PairClearedEvent(TypedDict):
    type: Literal["pair.cleared"]
    matchId: str


ServerToKiosk = Union[
    KioskIdleEvent,
    PairIncomingEvent,
    MissionShowEvent,
    StampProgressEvent,
    NfcWriteEvent,
    CelebrateEvent,
    PairClearedEvent,
]
# "pong" (auto-response to ping) is parsed as an unknown type and ignored.

# Required keys per event type (besides "type"). Keep in sync with events.ts.
SERVER_TO_KIOSK_KEYS: Final[dict[str, tuple[str, ...]]] = {
    "kiosk.idle": ("ridersInCar", "ridersOnTrain", "nextStop", "nextStopEtaSec", "serverNow"),
    "pair.incoming": ("matchId", "color", "firstNames", "arrived"),
    "mission.show": ("matchId", "color", "mission", "serverNow"),
    "stamp.progress": ("matchId", "tapped"),
    "nfc.write": ("writeId", "url"),
    "celebrate": ("matchId", "color", "rare"),
    "pair.cleared": ("matchId",),
}

# ---------- kiosk -> server ----------


class KioskHw(TypedDict):
    leds: bool
    nfc: NfcMode


class KioskHelloMsg(TypedDict):
    type: Literal["kiosk.hello"]
    car: str
    role: KioskRole
    hw: NotRequired[KioskHw]


class NfcWrittenMsg(TypedDict):
    """Pi confirms the tag was rewritten."""

    type: Literal["nfc.written"]
    writeId: str
    url: str


class NfcFailedMsg(TypedDict):
    """Pi reports the tag write failed after retries."""

    type: Literal["nfc.failed"]
    writeId: str
    reason: str


class PingMsg(TypedDict):
    type: Literal["ping"]


KioskToServer = Union[KioskHelloMsg, NfcWrittenMsg, NfcFailedMsg, PingMsg]


# ---------- helpers ----------


class ProtocolError(ValueError):
    """A message with a known type is missing fields or has bad values."""


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """'#ff8a00' -> (255, 138, 0)."""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"expected #rrggbb, got {hex_color!r}")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def pair_rgb(color: PairColor) -> tuple[int, int, int]:
    """RGB for a pair color name, from PAIR_COLOR_HEX."""
    return hex_to_rgb(PAIR_COLOR_HEX[color])


def parse_server_event(raw: str | bytes) -> ServerToKiosk | None:
    """Decode one server -> kiosk message.

    Returns None for unknown event types (forward compatible: the server may
    add screen-only events). Raises ProtocolError for bad JSON or a known type
    with missing or invalid fields.
    """
    try:
        msg = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ProtocolError(f"not JSON: {e}") from e
    if not isinstance(msg, dict) or not isinstance(msg.get("type"), str):
        raise ProtocolError("message must be an object with a string 'type'")

    required = SERVER_TO_KIOSK_KEYS.get(msg["type"])
    if required is None:
        return None
    missing = [k for k in required if k not in msg]
    if missing:
        raise ProtocolError(f"{msg['type']}: missing {', '.join(missing)}")
    if "color" in required and msg["color"] not in get_args(PairColor):
        raise ProtocolError(f"{msg['type']}: unknown color {msg['color']!r}")
    if msg["type"] == "nfc.write" and not str(msg["url"]).startswith(("https://", "http://")):
        raise ProtocolError("nfc.write: url must be http(s)")
    return msg  # type: ignore[return-value]


def kiosk_hello(car: str, leds: bool, nfc: NfcMode) -> KioskHelloMsg:
    return {"type": "kiosk.hello", "car": car, "role": "pi", "hw": {"leds": leds, "nfc": nfc}}


def nfc_written(write_id: str, url: str) -> NfcWrittenMsg:
    return {"type": "nfc.written", "writeId": write_id, "url": url}


def nfc_failed(write_id: str, reason: str) -> NfcFailedMsg:
    return {"type": "nfc.failed", "writeId": write_id, "reason": reason}


def ping() -> PingMsg:
    return {"type": "ping"}


def encode(msg: KioskToServer) -> str:
    """Serialize a kiosk -> server message."""
    return json.dumps(msg, separators=(",", ":"))
