"""Cancellable LED animations.

Each animation is a coroutine that draws on a ``LedStrip`` until it finishes
or is cancelled. ``AnimationPlayer`` runs exactly one at a time: ``play()``
cancels whatever is running and starts the new one, so event handlers never
have to care what was on before.

Event -> animation (wired in agent.py):
    kiosk.idle / pair.cleared  idle      dim slow breathing in leds.idle_color
    pair.incoming              solid     pair color, full brightness
    mission.show               pulse     pair color, slow pulse (~2.5 s period)
    celebrate                  burst     white-to-pair flash running outward
    celebrate (rare)           burst + rainbow
    socket down                idle      dim amber (OFFLINE_RGB)

All loops should run at ~FPS frames/s and ``await asyncio.sleep`` between
frames so cancellation is immediate.
"""

from __future__ import annotations

import asyncio
import logging
import math
from collections.abc import Coroutine
from typing import Any

from .leds import OFF, RGB, LedStrip

log = logging.getLogger(__name__)

FPS = 30
FRAME_S = 1.0 / FPS
OFFLINE_RGB: RGB = (255, 120, 0)
WHITE: RGB = (255, 255, 255)


def scale(rgb: RGB, factor: float) -> RGB:
    """Multiply a color by 0..1."""
    f = max(0.0, min(1.0, factor))
    return (int(rgb[0] * f), int(rgb[1] * f), int(rgb[2] * f))


def lerp(a: RGB, b: RGB, t: float) -> RGB:
    """Linear blend from a to b; t in 0..1."""
    t = max(0.0, min(1.0, t))
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def _breath_level(t: float, period_s: float, low: float, high: float) -> float:
    """Sine envelope between low and high over period_s."""
    return low + (high - low) * (0.5 - 0.5 * math.cos(2 * math.pi * t / period_s))


def wheel(pos: int) -> RGB:
    """Classic 0..255 color wheel (red -> green -> blue -> red)."""
    pos %= 256
    if pos < 85:
        return (255 - pos * 3, pos * 3, 0)
    if pos < 170:
        pos -= 85
        return (0, 255 - pos * 3, pos * 3)
    pos -= 170
    return (pos * 3, 0, 255 - pos * 3)


async def solid(strip: LedStrip, rgb: RGB) -> None:
    """Fill the strip with one color and return."""
    strip.fill(rgb)
    strip.show()


async def off(strip: LedStrip) -> None:
    strip.fill(OFF)
    strip.show()


async def idle(strip: LedStrip, rgb: RGB, period_s: float = 6.0, low: float = 0.02, high: float = 0.12) -> None:
    """Dim breathing loop, forever. Low enough that it doesn't compete with a pair color."""
    t = 0.0
    n = max(1, strip.count)
    while True:
        level = _breath_level(t, period_s, low, high)
        strip.fill(scale(rgb, level))
        # One slightly brighter pixel drifts along so the strip still looks alive.
        comet = int((t / period_s) * n) % n
        strip.set_pixel(comet, scale(rgb, min(1.0, level * 2.5 + 0.05)))
        strip.show()
        await asyncio.sleep(FRAME_S)
        t += FRAME_S


async def pulse(strip: LedStrip, rgb: RGB, period_s: float = 2.5, low: float = 0.2, high: float = 1.0) -> None:
    """Slow pulse in the pair color, forever (mission in progress)."""
    t = 0.0
    while True:
        level = _breath_level(t, period_s, low, high)
        strip.fill(scale(rgb, level))
        strip.show()
        await asyncio.sleep(FRAME_S)
        t += FRAME_S


async def burst(strip: LedStrip, rgb: RGB, duration_s: float = 2.0) -> None:
    """Celebration: white flash from the center outward, settling into the pair color."""
    n = max(1, strip.count)
    center = n // 2
    expand_s = max(0.05, duration_s * 0.4)
    fade_s = 0.15
    t = 0.0
    while t < expand_s:
        radius = (t / expand_s) * (n / 2)
        for i in range(n):
            dist = abs(i - center)
            if dist <= radius:
                # White at the wave front, blending toward the pair color behind it.
                age = (radius - dist) / max(1.0, n / 2)
                strip.set_pixel(i, lerp(WHITE, rgb, min(1.0, age * (expand_s / fade_s))))
            else:
                strip.set_pixel(i, OFF)
        strip.show()
        await asyncio.sleep(FRAME_S)
        t += FRAME_S

    # Two quick full-strip white flashes, then settle on the pair color.
    for _ in range(2):
        strip.fill(WHITE)
        strip.show()
        await asyncio.sleep(0.06)
        strip.fill(rgb)
        strip.show()
        await asyncio.sleep(0.08)

    remaining = duration_s - expand_s - 0.28
    if remaining > 0:
        await asyncio.sleep(remaining)
    await solid(strip, rgb)


async def rainbow(strip: LedStrip, duration_s: float | None = None, speed: int = 3) -> None:
    """Moving rainbow. Runs forever when duration_s is None."""
    offset = 0
    elapsed = 0.0
    n = max(1, strip.count)
    while duration_s is None or elapsed < duration_s:
        for i in range(n):
            strip.set_pixel(i, wheel((i * 256 // n + offset) & 255))
        strip.show()
        await asyncio.sleep(FRAME_S)
        offset = (offset + speed) & 255
        elapsed += FRAME_S


async def flash(strip: LedStrip, rgb: RGB = WHITE, duration_s: float = 0.2) -> None:
    """Short solid flash, then return (caller resumes the previous animation)."""
    await solid(strip, rgb)
    await asyncio.sleep(duration_s)


async def celebrate(strip: LedStrip, rgb: RGB, rare: bool, duration_s: float = 4.0) -> None:
    """burst, then rainbow for the rest of duration_s if rare, then hold the pair color."""
    burst_s = min(2.0, duration_s)
    await burst(strip, rgb, burst_s)
    if rare and duration_s > burst_s:
        await rainbow(strip, duration_s - burst_s)
    await solid(strip, rgb)


class AnimationPlayer:
    """Runs one animation task at a time on a strip."""

    def __init__(self, strip: LedStrip) -> None:
        self.strip = strip
        self._task: asyncio.Task[None] | None = None
        self.current: str | None = None

    def play(self, name: str, coro: Coroutine[Any, Any, None]) -> asyncio.Task[None]:
        """Cancel the running animation (if any) and start ``coro``."""
        self._cancel()
        self.current = name
        self._task = asyncio.create_task(self._guard(name, coro), name=f"anim:{name}")
        return self._task

    async def stop(self) -> None:
        """Cancel the running animation and wait for it to finish."""
        task = self._task
        self._cancel()
        if task is not None:
            try:
                await task
            except asyncio.CancelledError:
                pass

    def _cancel(self) -> None:
        if self._task is not None and not self._task.done():
            self._task.cancel()
        self._task = None
        self.current = None

    async def _guard(self, name: str, coro: Coroutine[Any, Any, None]) -> None:
        # A broken animation must never take down the socket loop.
        try:
            await coro
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("animation %s failed", name)
