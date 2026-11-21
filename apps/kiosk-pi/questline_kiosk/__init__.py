"""Questline kiosk agent.

Runs on the Raspberry Pi in each train car. It holds the Pi's WebSocket to the
TrainRoom (``wss://<domain>/ws/kiosk/<car>?key=...&role=pi``), drives the LED
strip from kiosk events, rewrites the dynamic NFC tag on ``nfc.write``, and
launches Chromium in kiosk mode for ``apps/kiosk-web``.

Modules:
    config      load + validate config.toml
    protocol    kiosk event types, mirrors packages/protocol/src/events.ts
    agent       asyncio main loop: connect, hello, ping, dispatch, reconnect
    leds        LedStrip interface, ws281x / SPI / fake implementations
    animations  cancellable LED animations (idle, solid, pulse, burst, rainbow)
    nfc_tag     NfcTag interface, NDEF URI builder, I2C tag writers
    browser     Chromium kiosk launcher
"""

__version__ = "0.1.0"
