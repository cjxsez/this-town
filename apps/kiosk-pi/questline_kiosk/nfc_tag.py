"""NFC tag writers and the NDEF URI builder.

The kiosk tag always holds one NDEF URI record:
    https://<domain>/k/<car>?n=<nonce>
iPhone XS and newer (and Android) read that in the background, with no app,
and show a banner that opens the link. During a mission the server sends
``nfc.write`` with a fresh nonce and the Pi rewrites the tag (stamp proof,
see docs/architecture.md "Location: NFC tap").

Byte layout written to a Type 2 style tag's user memory:
    03 <len> <NDEF message> FE        NDEF TLV + terminator TLV
    NDEF message = one short record:
    D1 01 <payload len> 55 <prefix code> <rest of URI, UTF-8>
      D1 = MB|ME|SR, TNF=0x01 (NFC Forum well-known), type "U" (0x55)

Implementations:
    DynamicNtagI2C  NXP NTAG I2C plus (NT3H2111 / NT3H2211) at 0x55
    DynamicSt25dv   ST25DV04K/16K/64K, user memory at 0x53
    StaticTag       NTAG215 sticker; cannot be written from the Pi, no-op
    NoTag           no tag on this kiosk
    FakeTag         in memory, prints writes (laptops)

The NDEF helpers are real and tested (tests/test_ndef.py). The I2C writers are
scaffolds; smbus2 is imported lazily so laptops don't need /dev/i2c-*.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Final

from .config import NfcConfig, NfcMode

log = logging.getLogger(__name__)

# NFC Forum URI Record Type Definition, table 3. Index = identifier code.
URI_PREFIXES: Final[tuple[str, ...]] = (
    "",                            # 0x00 no abbreviation
    "http://www.",                 # 0x01
    "https://www.",                # 0x02
    "http://",                     # 0x03
    "https://",                    # 0x04
    "tel:",                        # 0x05
    "mailto:",                     # 0x06
    "ftp://anonymous:anonymous@",  # 0x07
    "ftp://ftp.",                  # 0x08
    "ftps://",                     # 0x09
    "sftp://",                     # 0x0A
    "smb://",                      # 0x0B
    "nfs://",                      # 0x0C
    "ftp://",                      # 0x0D
    "dav://",                      # 0x0E
    "news:",                       # 0x0F
    "telnet://",                   # 0x10
    "imap:",                       # 0x11
    "rtsp://",                     # 0x12
    "urn:",                        # 0x13
    "pop:",                        # 0x14
    "sip:",                        # 0x15
    "sips:",                       # 0x16
    "tftp:",                       # 0x17
    "btspp://",                    # 0x18
    "btl2cap://",                  # 0x19
    "btgoep://",                   # 0x1A
    "tcpobex://",                  # 0x1B
    "irdaobex://",                 # 0x1C
    "file://",                     # 0x1D
    "urn:epc:id:",                 # 0x1E
    "urn:epc:tag:",                # 0x1F
    "urn:epc:pat:",                # 0x20
    "urn:epc:raw:",                # 0x21
    "urn:epc:",                    # 0x22
    "urn:nfc:",                    # 0x23
)

TNF_WELL_KNOWN: Final = 0x01
NDEF_MB: Final = 0x80
NDEF_ME: Final = 0x40
NDEF_SR: Final = 0x10
RTD_URI: Final = b"U"
TLV_NDEF: Final = 0x03
TLV_TERMINATOR: Final = 0xFE


class NfcTagError(RuntimeError):
    """Tag write failed or the URL doesn't fit."""


def pick_uri_prefix(url: str) -> tuple[int, str]:
    """Longest matching URI identifier code and the remainder of the URL."""
    best = 0
    for code, prefix in enumerate(URI_PREFIXES):
        if prefix and url.startswith(prefix) and len(prefix) > len(URI_PREFIXES[best]):
            best = code
    return best, url[len(URI_PREFIXES[best]):]


def build_ndef_uri_record(url: str) -> bytes:
    """One NDEF message containing a single URI record (MB and ME set).

    Uses a short record (1-byte payload length) when the payload is <= 255
    bytes, otherwise a normal record with a 4-byte big-endian length.
    """
    if not url:
        raise ValueError("url must not be empty")
    code, rest = pick_uri_prefix(url)
    payload = bytes([code]) + rest.encode("utf-8")
    header = NDEF_MB | NDEF_ME | TNF_WELL_KNOWN
    if len(payload) <= 0xFF:
        return bytes([header | NDEF_SR, len(RTD_URI), len(payload)]) + RTD_URI + payload
    return bytes([header, len(RTD_URI)]) + len(payload).to_bytes(4, "big") + RTD_URI + payload


def wrap_ndef_tlv(message: bytes) -> bytes:
    """Wrap an NDEF message in an NDEF TLV followed by a terminator TLV.

    Length is 1 byte below 0xFF, otherwise 0xFF followed by a 2-byte length.
    """
    n = len(message)
    if n > 0xFFFE:
        raise ValueError("NDEF message too long for a TLV")
    length = bytes([n]) if n < 0xFF else bytes([0xFF]) + n.to_bytes(2, "big")
    return bytes([TLV_NDEF]) + length + message + bytes([TLV_TERMINATOR])


def build_tag_payload(url: str, block_size: int = 1) -> bytes:
    """TLV-wrapped URI record, zero-padded to a multiple of block_size."""
    data = wrap_ndef_tlv(build_ndef_uri_record(url))
    if block_size > 1 and len(data) % block_size:
        data += bytes(block_size - len(data) % block_size)
    return data


class NfcTag(ABC):
    """Something the kiosk URL lives on."""

    mode: NfcMode

    @abstractmethod
    def write_url(self, url: str) -> None:
        """Replace the tag contents with one NDEF URI record. Blocking (I2C);
        call through asyncio.to_thread. Raises NfcTagError on failure."""

    def read_url(self) -> str | None:
        """Read back the current URI, if the hardware allows it."""
        return None

    def close(self) -> None:
        pass


class DynamicNtagI2C(NfcTag):
    """NXP NTAG I2C plus over I2C (default address 0x55).

    Memory as seen from I2C is 16-byte blocks. Block 0 holds the I2C address,
    serial number, static lock bytes and the Capability Container (bytes
    12..15, factory set to E1 10 6D 00 on the 1k part). NDEF user memory
    starts at block 1 (= NFC page 4).

    TODO:
    - from smbus2 import SMBus, i2c_msg; open SMBus(bus) in __init__
    - write_url:
        data = build_tag_payload(url, BLOCK_SIZE)
        check len(data) <= USER_BYTES_1K (888) else NfcTagError
        for each 16-byte chunk i: i2c_rdwr(i2c_msg.write(addr, [USER_START_BLOCK + i, *chunk]))
        sleep ~5 ms after each block (EEPROM write time)
    - NEVER write block 0 from I2C: its byte 0 is the I2C address and a bad
      write moves the chip to a different address
    - RF/I2C arbitration: if a phone is in the field the write can NAK.
      Read NS_REG (session register block 0xFE, byte 6) and wait for
      RF_LOCKED to clear, retry up to write_retries
    - optional: watch the FD pin (field detect) on a GPIO to log taps
    - read_url: read blocks from 1 until the 0xFE terminator, parse the record
    """

    BLOCK_SIZE: Final = 16
    USER_START_BLOCK: Final = 1
    USER_BYTES_1K: Final = 888
    DEFAULT_ADDRESS: Final = 0x55

    mode: NfcMode = "dynamic"

    def __init__(self, bus: int = 1, address: int = DEFAULT_ADDRESS, retries: int = 3) -> None:
        self.bus = bus
        self.address = address
        self.retries = retries
        raise NotImplementedError("DynamicNtagI2C: see TODO in docstring")

    def write_url(self, url: str) -> None:
        raise NotImplementedError

    def read_url(self) -> str | None:
        raise NotImplementedError

    def close(self) -> None:
        raise NotImplementedError  # TODO: self._bus.close()


class DynamicSt25dv(NfcTag):
    """ST25DV04K/16K/64K over I2C. User memory at 0x53, system config at 0x57.

    User memory uses 16-bit addresses. The CC file lives at address 0 and the
    NDEF TLV starts right after it (address 4 with a 4-byte CC, 8 with an
    8-byte CC for parts over 2040 bytes).

    TODO:
    - from smbus2 import SMBus, i2c_msg
    - on first use, check the CC (E1/E2 40 ...) and write one if blank
      (scripts/write_static_tag.py --format); confirm CC bytes against the datasheet
    - write_url: data = build_tag_payload(url); write in <= 16 byte chunks as
      i2c_msg.write(0x53, [addr >> 8, addr & 0xFF, *chunk]); poll for ACK
      (EEPROM write ~5 ms per 4-byte row) between chunks
    - RF arbitration: if RF is busy the write NAKs; retry up to write_retries
    - Adafruit 4701 breakout has an onboard antenna and STEMMA QT (3.3 V)
    """

    DEFAULT_ADDRESS: Final = 0x53

    mode: NfcMode = "dynamic"

    def __init__(self, bus: int = 1, address: int = DEFAULT_ADDRESS, retries: int = 3) -> None:
        self.bus = bus
        self.address = address
        self.retries = retries
        raise NotImplementedError("DynamicSt25dv: see TODO in docstring")

    def write_url(self, url: str) -> None:
        raise NotImplementedError

    def read_url(self) -> str | None:
        raise NotImplementedError


class StaticTag(NfcTag):
    """NTAG215 sticker with a fixed /k/<car> URL. The Pi can't write it, so
    nfc.write is ignored and stamps fall back to the weaker proof."""

    mode: NfcMode = "static"

    def write_url(self, url: str) -> None:
        log.warning("static tag: ignoring nfc.write %s", url)


class NoTag(NfcTag):
    mode: NfcMode = "none"

    def write_url(self, url: str) -> None:
        log.warning("no tag: ignoring nfc.write %s", url)


class FakeTag(NfcTag):
    """Pretends to be a dynamic tag. Keeps the last URL and payload bytes."""

    mode: NfcMode = "dynamic"

    def __init__(self) -> None:
        self.url: str | None = None
        self.payload: bytes = b""
        self.writes = 0

    def write_url(self, url: str) -> None:
        self.payload = build_tag_payload(url, DynamicNtagI2C.BLOCK_SIZE)
        self.url = url
        self.writes += 1
        print(f"[nfc] wrote {url} ({len(self.payload)} bytes)", flush=True)

    def read_url(self) -> str | None:
        return self.url


def make_tag(cfg: NfcConfig) -> NfcTag:
    """Pick the tag implementation from config."""
    if cfg.mode == "none":
        return NoTag()
    if cfg.mode == "static":
        return StaticTag()
    if cfg.chip == "fake":
        return FakeTag()
    if cfg.chip == "st25dv":
        return DynamicSt25dv(cfg.i2c_bus, cfg.i2c_address, cfg.write_retries)
    return DynamicNtagI2C(cfg.i2c_bus, cfg.i2c_address, cfg.write_retries)
