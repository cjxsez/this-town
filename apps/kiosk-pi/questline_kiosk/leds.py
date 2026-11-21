"""LED strip drivers behind one small interface.

``LedStrip`` is what animations draw on: set pixels, then ``show()``.
Implementations:

    Ws281xStrip      rpi_ws281x. Pi 4, data on GPIO18 (PWM0). PWM/PCM need
                     root (/dev/mem); GPIO10 (SPI) works as a normal user in
                     the ``spi`` group. Not supported on Pi 5.
    NeopixelSpiStrip adafruit-circuitpython-neopixel-spi. Data on GPIO10
                     (SPI0 MOSI). Works on Pi 5 and Pi 4, no root.
    FakeLeds         prints a row of truecolor blocks to the terminal. For
                     laptops and CI.
    NullLeds         does nothing (leds.enabled = false).

Hardware libraries are imported lazily inside each class so the package
imports on a laptop without them installed.

Data line is 3.3 V from the Pi and must go through a 74AHCT125 level shifter
to the strip's 5 V DIN. See docs/hardware.md.
"""

from __future__ import annotations

import logging
import sys
import time
from abc import ABC, abstractmethod

from .config import LedConfig

log = logging.getLogger(__name__)

RGB = tuple[int, int, int]
OFF: RGB = (0, 0, 0)


class LedStrip(ABC):
    """A strip of ``count`` addressable RGB pixels."""

    count: int

    @abstractmethod
    def set_pixel(self, index: int, rgb: RGB) -> None:
        """Set one pixel in the back buffer. Not visible until show()."""

    def fill(self, rgb: RGB) -> None:
        """Set every pixel in the back buffer."""
        for i in range(self.count):
            self.set_pixel(i, rgb)

    @abstractmethod
    def show(self) -> None:
        """Push the back buffer to the strip. Blocking but fast (~1 ms for 30 px)."""

    @abstractmethod
    def set_brightness(self, brightness: float) -> None:
        """Global brightness 0.0..1.0, applied on top of pixel values."""

    def clear(self) -> None:
        self.fill(OFF)
        self.show()

    def close(self) -> None:
        """Turn the strip off and release the hardware."""
        self.clear()


class Ws281xStrip(LedStrip):
    """rpi_ws281x ``PixelStrip`` on a Pi 4 (GPIO18 PWM by default).

    TODO:
    - from rpi_ws281x import PixelStrip, Color, ws
    - channel = 1 if pin in (13, 19) else 0; dma = 10; freq_hz = 800_000
    - strip_type from order: "GRB" -> ws.WS2811_STRIP_GRB, etc.
    - PixelStrip(count, pin, 800_000, 10, False, int(brightness * 255), channel, strip_type).begin()
    - GPIO18 PWM conflicts with analog audio: dtparam=audio=off in /boot/firmware/config.txt
    - PWM needs root. Either run the agent service as root or use pin 10 (SPI).
    - raise a clear error if running on a Pi 5 (/proc/device-tree/model contains "Raspberry Pi 5")
    """

    def __init__(self, pin: int, count: int, brightness: float, order: str = "GRB") -> None:
        self.count = count
        raise NotImplementedError("Ws281xStrip: see TODO in docstring")

    def set_pixel(self, index: int, rgb: RGB) -> None:
        raise NotImplementedError  # TODO: self._strip.setPixelColor(index, Color(*rgb))

    def show(self) -> None:
        raise NotImplementedError  # TODO: self._strip.show()

    def set_brightness(self, brightness: float) -> None:
        raise NotImplementedError  # TODO: self._strip.setBrightness(int(brightness * 255))


class NeopixelSpiStrip(LedStrip):
    """WS2812 over SPI0 MOSI (GPIO10) via adafruit-circuitpython-neopixel-spi.

    TODO:
    - import board, neopixel_spi
    - self._px = neopixel_spi.NeoPixel_SPI(board.SPI(), count, pixel_order=neopixel_spi.GRB,
          brightness=brightness, auto_write=False)
    - needs dtparam=spi=on and the user in the ``spi`` group
    - on Pi 4 the SPI clock follows core_freq: set core_freq=500 and core_freq_min=500
      in config.txt or colors glitch
    """

    def __init__(self, count: int, brightness: float, order: str = "GRB") -> None:
        self.count = count
        raise NotImplementedError("NeopixelSpiStrip: see TODO in docstring")

    def set_pixel(self, index: int, rgb: RGB) -> None:
        raise NotImplementedError  # TODO: self._px[index] = rgb

    def show(self) -> None:
        raise NotImplementedError  # TODO: self._px.show()

    def set_brightness(self, brightness: float) -> None:
        raise NotImplementedError  # TODO: self._px.brightness = brightness


class FakeLeds(LedStrip):
    """Prints the strip as truecolor blocks. Only prints when the frame changes,
    and at most ``max_fps`` times a second so animations don't flood the terminal."""

    def __init__(self, count: int = 30, brightness: float = 0.4, max_fps: float = 4.0) -> None:
        self.count = count
        self.brightness = brightness
        self._pixels: list[RGB] = [OFF] * count
        self._last_frame: tuple[RGB, ...] | None = None
        self._last_print = 0.0
        self._min_interval = 1.0 / max_fps if max_fps > 0 else 0.0

    @property
    def pixels(self) -> list[RGB]:
        return list(self._pixels)

    def set_pixel(self, index: int, rgb: RGB) -> None:
        self._pixels[index] = rgb

    def show(self) -> None:
        frame = tuple(self._pixels)
        now = time.monotonic()
        if frame == self._last_frame or now - self._last_print < self._min_interval:
            return
        self._last_frame, self._last_print = frame, now
        b = self.brightness
        blocks = "".join(
            f"\x1b[38;2;{int(r * b)};{int(g * b)};{int(bl * b)}m█" for r, g, bl in frame
        )
        sys.stdout.write(f"[leds] {blocks}\x1b[0m\n")
        sys.stdout.flush()

    def set_brightness(self, brightness: float) -> None:
        self.brightness = brightness


class NullLeds(LedStrip):
    """No strip attached."""

    def __init__(self, count: int = 0) -> None:
        self.count = count

    def set_pixel(self, index: int, rgb: RGB) -> None:
        pass

    def show(self) -> None:
        pass

    def set_brightness(self, brightness: float) -> None:
        pass


def make_strip(cfg: LedConfig) -> LedStrip:
    """Pick the driver from config."""
    if not cfg.enabled:
        return NullLeds()
    if cfg.driver == "fake":
        return FakeLeds(cfg.count, cfg.brightness)
    if cfg.driver == "neopixel_spi":
        if cfg.pin != 10:
            log.warning("leds.pin=%s ignored: neopixel_spi always uses GPIO10 (SPI0 MOSI)", cfg.pin)
        return NeopixelSpiStrip(cfg.count, cfg.brightness, cfg.order)
    return Ws281xStrip(cfg.pin, cfg.count, cfg.brightness, cfg.order)
