"""Tests for the NDEF URI record builder in questline_kiosk.nfc_tag."""

import pytest

from questline_kiosk.nfc_tag import (
    URI_PREFIXES,
    build_ndef_uri_record,
    build_tag_payload,
    parse_tag_url,
    pick_uri_prefix,
    wrap_ndef_tlv,
)


def test_prefix_table_matches_spec_size():
    assert len(URI_PREFIXES) == 0x24
    assert URI_PREFIXES[0x04] == "https://"
    assert URI_PREFIXES[0x23] == "urn:nfc:"


@pytest.mark.parametrize(
    "url,code,rest",
    [
        ("https://example.com", 0x04, "example.com"),
        ("https://www.example.com", 0x02, "example.com"),  # longest match wins
        ("http://example.com", 0x03, "example.com"),
        ("urn:epc:id:123", 0x1E, "123"),
        ("spotify:track:1", 0x00, "spotify:track:1"),
    ],
)
def test_pick_uri_prefix(url, code, rest):
    assert pick_uri_prefix(url) == (code, rest)


def test_short_record_bytes():
    rec = build_ndef_uri_record("https://example.com")
    assert rec == bytes([0xD1, 0x01, 0x0C, 0x55, 0x04]) + b"example.com"


def test_kiosk_url_record():
    url = "https://q.example/k/1412?n=ab12cd34"
    rec = build_ndef_uri_record(url)
    body = b"q.example/k/1412?n=ab12cd34"
    assert rec[0] == 0xD1
    assert rec[2] == len(body) + 1
    assert rec[3:5] == b"U\x04"
    assert rec[5:] == body


def test_long_record_uses_4_byte_length():
    url = "https://example.com/" + "a" * 300
    rec = build_ndef_uri_record(url)
    payload_len = 1 + len(url) - len("https://")
    assert rec[0] == 0xC1  # MB|ME, SR clear, TNF well-known
    assert rec[1] == 0x01
    assert int.from_bytes(rec[2:6], "big") == payload_len
    assert rec[6:8] == b"U\x04"
    assert len(rec) == 6 + 1 + payload_len


def test_utf8_payload():
    rec = build_ndef_uri_record("https://example.com/café")
    assert rec.endswith("café".encode("utf-8"))
    assert rec[2] == 1 + len("example.com/café".encode("utf-8"))


def test_empty_url_rejected():
    with pytest.raises(ValueError):
        build_ndef_uri_record("")


def test_tlv_short_and_long():
    assert wrap_ndef_tlv(b"\x01\x02") == b"\x03\x02\x01\x02\xfe"
    msg = bytes(300)
    tlv = wrap_ndef_tlv(msg)
    assert tlv[:4] == b"\x03\xff\x01\x2c"
    assert tlv[-1] == 0xFE
    assert len(tlv) == 4 + 300 + 1


def test_tag_payload_padded_to_block():
    data = build_tag_payload("https://example.com", block_size=16)
    assert len(data) % 16 == 0
    tlv = wrap_ndef_tlv(build_ndef_uri_record("https://example.com"))
    assert data.startswith(tlv)
    assert set(data[len(tlv):]) <= {0}


def test_typical_kiosk_url_fits_ntag215():
    # NTAG215 has 504 bytes of user memory; keep tag URLs well under that.
    data = build_tag_payload("https://questline.example.com/k/1412?n=0123456789ab")
    assert len(data) < 100


def test_parse_tag_url_round_trip():
    url = "https://q.example/k/1412?n=ab12cd34"
    data = build_tag_payload(url, block_size=16)
    assert parse_tag_url(data) == url


def test_parse_tag_url_empty():
    assert parse_tag_url(b"") is None
    assert parse_tag_url(b"\xfe") is None
