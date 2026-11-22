"""Fake-SMBus tests for DynamicNtagI2C and DynamicSt25dv block layout and retries."""

from __future__ import annotations

import pytest
from smbus2 import i2c_msg

from questline_kiosk.nfc_tag import (
    DynamicNtagI2C,
    DynamicSt25dv,
    NfcTagError,
    build_tag_payload,
)


class FakeSMBus:
    """Minimal SMBus stand-in that records writes and serves programmed memory."""

    def __init__(self) -> None:
        self.memory: dict[int, int] = {}  # flat byte address -> value
        self.write_log: list[bytes] = []
        self.fail_remaining = 0
        self.rdwr_calls = 0

    def i2c_rdwr(self, *msgs: i2c_msg) -> None:
        self.rdwr_calls += 1
        if self.fail_remaining > 0:
            self.fail_remaining -= 1
            raise OSError("I2C NAK (simulated RF busy)")

        i = 0
        while i < len(msgs):
            msg = msgs[i]
            flags = getattr(msg, "flags", 0)
            buf = bytes(msg)
            is_read = bool(flags & 0x0001)  # I2C_M_RD
            if is_read:
                # Should be preceded by an address write; start addr already applied.
                raise AssertionError("unexpected lone read")
            # Write: either address-only (followed by read) or address+data.
            if i + 1 < len(msgs) and getattr(msgs[i + 1], "flags", 0) & 0x0001:
                start = self._addr_from_prefix(buf)
                read_msg = msgs[i + 1]
                length = len(bytes(read_msg))
                data = bytes(self.memory.get(start + j, 0) for j in range(length))
                # Fill the read message buffer in place.
                for j, b in enumerate(data):
                    read_msg.buf[j] = b  # type: ignore[attr-defined]
                i += 2
            else:
                self.write_log.append(buf)
                start, payload = self._split_write(buf)
                for j, b in enumerate(payload):
                    self.memory[start + j] = b
                i += 1

    def _addr_from_prefix(self, buf: bytes) -> int:
        # NTAG: 1-byte block number. ST25DV: 2-byte big-endian address.
        if len(buf) == 1:
            return buf[0] * 16
        if len(buf) == 2:
            return (buf[0] << 8) | buf[1]
        # Address + payload in one message — return start only.
        if len(buf) >= 17 and (len(buf) - 1) % 16 == 0:
            return buf[0] * 16
        return (buf[0] << 8) | buf[1]

    def _split_write(self, buf: bytes) -> tuple[int, bytes]:
        if len(buf) >= 17 and (len(buf) - 1) % 16 == 0:
            # NTAG block write: [block, *16 bytes]
            return buf[0] * 16, buf[1:]
        # ST25DV: [addr_hi, addr_lo, *page]
        return (buf[0] << 8) | buf[1], buf[2:]

    def close(self) -> None:
        pass


def test_ntag_writes_16_byte_blocks_from_block_1():
    bus = FakeSMBus()
    tag = DynamicNtagI2C(retries=0, smbus=bus)
    url = "https://q.example/k/1412?n=ab12cd34"
    tag.write_url(url)

    expected = build_tag_payload(url, 16)
    # Block 0 must never appear as a write target.
    for raw in bus.write_log:
        assert raw[0] >= 1
        assert len(raw) == 17  # block + 16 data

    # User memory starting at block 1 (= byte 16 in our flat map... wait:
    # we map block N -> byte N*16, and USER_START_BLOCK=1, so first write is at byte 16.
    # But NTAG user memory from I2C starts at block 1; our Fake maps block*16.
    # read_url / parse expects the TLV at the start of what _read_blocks returns,
    # which starts at block 1. So memory keys 16.. hold the payload — and
    # _read_blocks reads block 1 first into offset 0 of the buffer. Good.
    stored = bytes(bus.memory.get(16 + i, 0) for i in range(len(expected)))
    assert stored == expected
    assert tag.read_url() == url


def test_ntag_retries_on_nak_then_succeeds():
    bus = FakeSMBus()
    bus.fail_remaining = 2
    tag = DynamicNtagI2C(retries=3, smbus=bus)
    url = "https://q.example/k/1412?n=deadbeef"
    tag.write_url(url)
    assert tag.read_url() == url
    assert bus.rdwr_calls > 2


def test_ntag_raises_after_retries_exhausted():
    bus = FakeSMBus()
    bus.fail_remaining = 100
    tag = DynamicNtagI2C(retries=1, smbus=bus)
    with pytest.raises(NfcTagError):
        tag.write_url("https://q.example/k/1412?n=nope")


def test_st25dv_writes_after_cc_with_2_byte_addresses():
    bus = FakeSMBus()
    tag = DynamicSt25dv(retries=0, smbus=bus)
    url = "https://q.example/k/1413?n=cafebabe"
    tag.write_url(url)

    # CC at address 0.
    cc = bytes(bus.memory.get(i, 0) for i in range(4))
    assert cc[0] in (0xE1, 0xE2)

    # Every data write uses a 2-byte address prefix.
    for raw in bus.write_log:
        assert len(raw) == 2 + DynamicSt25dv.PAGE_SIZE

    assert tag.read_url() == url


def test_st25dv_retries_on_nak():
    bus = FakeSMBus()
    bus.fail_remaining = 1
    tag = DynamicSt25dv(retries=2, smbus=bus)
    url = "https://q.example/k/1413?n=retry01"
    tag.write_url(url)
    assert tag.read_url() == url
