#!/usr/bin/env python3
"""One-off: put the static check-in URL ``https://<domain>/k/<car>`` on a tag.

This is the fallback from docs/architecture.md: a tag without a nonce, so
check-in works but stamp proof is weaker.

Two targets:
    --target phone    (default) for NTAG215 stickers. The Pi can't write a
                      passive sticker (it has no NFC reader), so this prints
                      the URL, the exact NDEF bytes, and steps for a phone app
                      (NXP TagWriter or NFC Tools).
    --target dynamic  writes the static URL to the kiosk's dynamic I2C tag,
                      so the tag still works if the agent is stopped.
    --format          (with --target dynamic) also write a fresh Capability
                      Container first. TODO, ST25DV only.

Usage:
    .venv/bin/python scripts/write_static_tag.py --config config.toml
    .venv/bin/python scripts/write_static_tag.py --domain q.example --car 1413
    .venv/bin/python scripts/write_static_tag.py --config config.toml --target dynamic
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from questline_kiosk.config import CAR_ID_RE, load_config  # noqa: E402
from questline_kiosk.nfc_tag import build_tag_payload, make_tag  # noqa: E402

PHONE_STEPS = """\
Write it with a phone (iPhone or Android):
  NXP TagWriter: Write tags -> New dataset -> Link -> paste the URL -> Save & write -> hold the sticker to the phone.
  NFC Tools:     Write -> Add a record -> URL/URI -> paste the URL -> Write -> hold the sticker to the phone.
Then test: lock the phone, wake the screen, tap the sticker. A banner should open the link.
Optional: lock the sticker read-only (NFC Tools: Other -> Lock tag). This is permanent.
"""


def resolve(args: argparse.Namespace) -> tuple[str, str]:
    """Return (url, car) from --config or --domain/--car."""
    if args.config:
        cfg = load_config(args.config)
        return cfg.static_tag_url, cfg.car
    if not (args.domain and args.car):
        raise SystemExit("pass --config, or both --domain and --car")
    if not CAR_ID_RE.match(args.car):
        raise SystemExit(f"bad car id {args.car!r}")
    return f"https://{args.domain}/k/{args.car}", args.car


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--config")
    p.add_argument("--domain")
    p.add_argument("--car")
    p.add_argument("--target", choices=["phone", "dynamic"], default="phone")
    p.add_argument("--format", action="store_true")
    args = p.parse_args(argv)

    url, car = resolve(args)
    payload = build_tag_payload(url)
    print(f"car {car}: {url}")
    print(f"NDEF TLV ({len(payload)} bytes, NTAG215 holds 504): {payload.hex(' ')}")

    if args.target == "phone":
        print()
        print(PHONE_STEPS)
        return 0

    if not args.config:
        raise SystemExit("--target dynamic needs --config (for the I2C bus/address)")
    cfg = load_config(args.config)
    if cfg.nfc.mode != "dynamic":
        raise SystemExit(f"nfc.mode is {cfg.nfc.mode!r}; the dynamic writer needs mode = 'dynamic'")
    if args.format:
        # TODO: write a Capability Container for a blank ST25DV before the NDEF TLV.
        raise NotImplementedError("--format")
    tag = make_tag(cfg.nfc)
    tag.write_url(url)
    print(f"wrote {url} to {cfg.nfc.chip} at 0x{cfg.nfc.i2c_address:02x}")
    # TODO: read back with tag.read_url() and compare
    tag.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
