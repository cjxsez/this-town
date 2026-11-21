"""Entry point: ``python -m questline_kiosk [agent|browser|urls]``.

    agent    (default) run the LED/NFC agent and kiosk socket
    browser  exec Chromium in kiosk mode on the kiosk-web URL
    urls     print the socket, screen and static tag URLs (key masked)

Options:
    --config PATH   default $QUESTLINE_CONFIG or ./config.toml
    --fake          FakeLeds + FakeTag, for laptops
    --log-level     overrides agent.log_level

systemd runs ``agent`` from questline-agent.service and ``browser`` from
questline-browser.service.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys

from .config import ConfigError, load_config, with_fake_hardware


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="questline_kiosk", description="Questline kiosk agent")
    p.add_argument("command", nargs="?", default="agent", choices=["agent", "browser", "urls"])
    p.add_argument("--config", default=os.environ.get("QUESTLINE_CONFIG", "config.toml"))
    p.add_argument("--fake", action="store_true", help="use FakeLeds and FakeTag (no hardware)")
    p.add_argument("--log-level", default=None)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        cfg = load_config(args.config)
    except ConfigError as e:
        print(f"config error: {e}", file=sys.stderr)
        return 2
    if args.fake:
        cfg = with_fake_hardware(cfg)

    logging.basicConfig(
        level=(args.log_level or cfg.agent.log_level).upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if args.command == "urls":
        mask = lambda s: s.replace(cfg.kiosk_key, "***")  # noqa: E731
        print("socket :", mask(cfg.ws_url))
        print("screen :", mask(cfg.kiosk_page_url))
        print("tag    :", cfg.static_tag_url)
        return 0

    if args.command == "browser":
        from .browser import launch

        launch(cfg)  # does not return

    from .agent import run_agent

    try:
        asyncio.run(run_agent(cfg))
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
