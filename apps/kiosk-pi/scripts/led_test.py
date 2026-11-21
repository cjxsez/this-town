#!/usr/bin/env python3
"""LED smoke test: walk through every animation and pair color.

Use it right after wiring the strip, before involving the server.

    .venv/bin/python scripts/led_test.py --config config.toml
    .venv/bin/python scripts/led_test.py --fake            # laptop, prints colors
    sudo .venv/bin/python scripts/led_test.py --config config.toml   # ws281x on GPIO18 needs root

Sequence:
    1. each pixel red one by one (checks count and data direction)
    2. solid in every PAIR_COLOR_HEX color, 1 s each
    3. idle, pulse, burst, rainbow, 3 s each
    4. off
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from questline_kiosk import animations as anim  # noqa: E402
from questline_kiosk.config import LedConfig, load_config  # noqa: E402
from questline_kiosk.leds import FakeLeds, LedStrip, make_strip  # noqa: E402
from questline_kiosk.protocol import PAIR_COLOR_HEX, hex_to_rgb, pair_rgb  # noqa: E402

STEP_S = 3.0


async def run(strip: LedStrip, idle_rgb: tuple[int, int, int]) -> None:
    player = anim.AnimationPlayer(strip)

    print("chase")
    for i in range(strip.count):
        strip.fill(anim.OFF)
        strip.set_pixel(i, (255, 0, 0))
        strip.show()
        await asyncio.sleep(0.03)

    for name in PAIR_COLOR_HEX:
        print(f"solid {name}")
        await anim.solid(strip, pair_rgb(name))
        await asyncio.sleep(1.0)

    steps = {
        "idle": lambda: anim.idle(strip, idle_rgb),
        "pulse": lambda: anim.pulse(strip, pair_rgb("orange")),
        "burst": lambda: anim.burst(strip, pair_rgb("green"), duration_s=STEP_S),
        "rainbow": lambda: anim.rainbow(strip, duration_s=STEP_S),
    }
    for name, make in steps.items():
        print(name)
        player.play(name, make())
        await asyncio.sleep(STEP_S)
    await player.stop()
    strip.clear()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="LED smoke test")
    p.add_argument("--config")
    p.add_argument("--fake", action="store_true")
    p.add_argument("--count", type=int, default=30, help="pixel count when no --config")
    args = p.parse_args(argv)

    led_cfg = load_config(args.config).leds if args.config else LedConfig(count=args.count)
    strip: LedStrip = FakeLeds(led_cfg.count, led_cfg.brightness, max_fps=30) if args.fake else make_strip(led_cfg)
    try:
        asyncio.run(run(strip, hex_to_rgb(led_cfg.idle_color)))
    except KeyboardInterrupt:
        pass
    finally:
        strip.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
