"""The agent's asyncio main loop.

One long-lived outbound WebSocket to the car's TrainRoom:
    wss://<domain>/ws/kiosk/<car>?key=<KIOSK_KEY>&role=pi

Per connection:
    1. send kiosk.hello {car, role: "pi", hw: {leds, nfc}}
    2. start a ping loop (kiosk -> server "ping" every agent.ping_interval_s)
    3. read events and dispatch:
         kiosk.idle    -> idle animation, unless a pair is active
         pair.incoming -> solid pair color
         mission.show  -> slow pulse in the pair color
         nfc.write     -> write URL to the tag, reply nfc.written {writeId, url} or nfc.failed
         celebrate     -> burst (+ rainbow if rare), then hold the pair color
         pair.cleared  -> idle animation (only if it matches the active pair)
On disconnect: dim amber idle, wait with jittered exponential backoff
(agent.reconnect_min_s .. reconnect_max_s), reconnect. Backoff resets after a
connection that stayed up for a while.

Hardware calls (I2C writes) are blocking and go through asyncio.to_thread so
they never stall the socket or the animations.
"""

from __future__ import annotations

import asyncio
import logging
import random
from collections.abc import Iterator

from . import animations as anim
from .config import Config
from .leds import LedStrip, make_strip
from .nfc_tag import NfcTag, NfcTagError, make_tag
from websockets.asyncio.client import ClientConnection

from .protocol import (
    CelebrateEvent,
    KioskIdleEvent,
    KioskToServer,
    MissionShowEvent,
    NfcWriteEvent,
    PairClearedEvent,
    PairColor,
    PairIncomingEvent,
    ServerToKiosk,
    encode,
    hex_to_rgb,
    kiosk_hello,
    nfc_failed,
    nfc_written,
    pair_rgb,
    ping,
)

log = logging.getLogger(__name__)

# A connection that lasted this long resets the backoff.
STABLE_CONNECTION_S = 30.0


def backoff_delays(min_s: float, max_s: float, factor: float = 2.0, jitter: float = 0.2) -> Iterator[float]:
    """Infinite jittered exponential backoff: min_s, 2*min_s, ... capped at max_s, +/- jitter."""
    delay = min_s
    while True:
        yield max(0.0, delay * random.uniform(1 - jitter, 1 + jitter))
        delay = min(max_s, delay * factor)


class KioskAgent:
    """Owns the socket, the LED player and the tag for one kiosk."""

    def __init__(self, cfg: Config, leds: LedStrip, tag: NfcTag) -> None:
        self.cfg = cfg
        self.leds = leds
        self.tag = tag
        self.player = anim.AnimationPlayer(leds)
        self.idle_rgb = hex_to_rgb(cfg.leds.idle_color)
        # Current pair shown at this kiosk. One at a time (see protocol gaps in protocol.md).
        self.active_match: str | None = None
        self.active_color: PairColor | None = None
        self.last_nfc_url: str | None = None
        self._stopping = asyncio.Event()
        self._ws: ClientConnection | None = None

    # ---------- connection ----------

    async def run(self) -> None:
        """Connect forever until stop() is called.

        TODO:
        - from websockets.asyncio.client import connect
        - delays = backoff_delays(cfg.agent.reconnect_min_s, cfg.agent.reconnect_max_s)
        - loop until self._stopping is set:
            try: async with connect(cfg.ws_url, open_timeout=10, ping_interval=20,
                                    ping_timeout=20, max_size=64 * 1024) as ws:
                     started = loop.time(); await self._session(ws)
            except (OSError, websockets.exceptions.WebSocketException, TimeoutError) as e:
                log.warning(...)  # never log cfg.ws_url, it contains the key
            if connection lasted >= STABLE_CONNECTION_S: delays = fresh backoff
            self._show_offline(); await asyncio.wait_for(self._stopping.wait(), next(delays))
        - a 401/403 on the upgrade (InvalidStatus) means a bad kiosk_key or car:
          log loudly and back off at reconnect_max_s
        """
        raise NotImplementedError

    async def _session(self, ws: object) -> None:
        """One connected session: hello, ping loop, read loop.

        TODO:
        - self._ws = ws
        - await self.send(kiosk_hello(cfg.car, leds=cfg.leds.enabled, nfc=self.tag.mode))
        - ping_task = asyncio.create_task(self._ping_loop())
        - async for raw in ws:
              try: event = parse_server_event(raw)
              except ProtocolError: log.warning and continue
              if event is not None: await self.dispatch(event)
        - finally: ping_task.cancel(); self._ws = None
        - LEDs keep their current state on reconnect; the server is expected to
          resend the current kiosk state after kiosk.hello (see protocol.md gaps)
        """
        raise NotImplementedError

    async def _ping_loop(self) -> None:
        """Send {"type": "ping"} every agent.ping_interval_s.

        App-level ping on top of the websocket library's protocol pings, so the
        TrainRoom sees the Pi as alive even with the DO hibernating.
        """
        interval = self.cfg.agent.ping_interval_s
        while True:
            await asyncio.sleep(interval)
            await self.send(ping())

    async def send(self, msg: KioskToServer) -> None:
        """Send one message if connected; drop it (with a log) if not."""
        if self._ws is None:
            log.debug("not connected, dropping %s", msg["type"])
            return
        await self._ws.send(encode(msg))

    async def stop(self) -> None:
        """Stop reconnecting, close the socket, turn LEDs off."""
        self._stopping.set()
        await self.player.stop()
        # TODO: close self._ws with code 1001 (going away)
        self.leds.close()
        self.tag.close()

    # ---------- dispatch ----------

    async def dispatch(self, event: ServerToKiosk) -> None:
        match event["type"]:
            case "kiosk.idle":
                await self.on_kiosk_idle(event)  # type: ignore[arg-type]
            case "pair.incoming":
                await self.on_pair_incoming(event)  # type: ignore[arg-type]
            case "mission.show":
                await self.on_mission_show(event)  # type: ignore[arg-type]
            case "nfc.write":
                await self.on_nfc_write(event)  # type: ignore[arg-type]
            case "celebrate":
                await self.on_celebrate(event)  # type: ignore[arg-type]
            case "pair.cleared":
                await self.on_pair_cleared(event)  # type: ignore[arg-type]
            case "stamp.progress":
                pass  # TODO: optional LED flash when the first rider taps

    async def on_kiosk_idle(self, event: KioskIdleEvent) -> None:
        # kiosk.idle also carries live stats for the screen and may arrive while
        # a pair is active; only go idle when nothing is showing.
        if self.active_match is None and self.player.current != "idle":
            self._show_idle()

    async def on_pair_incoming(self, event: PairIncomingEvent) -> None:
        self.active_match, self.active_color = event["matchId"], event["color"]
        self.player.play("solid", anim.solid(self.leds, pair_rgb(event["color"])))

    async def on_mission_show(self, event: MissionShowEvent) -> None:
        self.active_match, self.active_color = event["matchId"], event["color"]
        self.player.play("pulse", anim.pulse(self.leds, pair_rgb(event["color"])))

    async def on_celebrate(self, event: CelebrateEvent) -> None:
        self.active_match, self.active_color = event["matchId"], event["color"]
        self.player.play(
            "celebrate",
            anim.celebrate(self.leds, pair_rgb(event["color"]), event["rare"], self.cfg.agent.celebrate_s),
        )

    async def on_pair_cleared(self, event: PairClearedEvent) -> None:
        if self.active_match not in (None, event["matchId"]):
            log.info("pair.cleared for %s but showing %s, ignoring", event["matchId"], self.active_match)
            return
        self.active_match = self.active_color = None
        self._show_idle()

    async def on_nfc_write(self, event: NfcWriteEvent) -> None:
        """Write the URL to the tag, then confirm with nfc.written.

        TODO:
        - retry with a short sleep (RF arbitration) up to cfg.nfc.write_retries
        - optional: read back with tag.read_url() and compare before acking
        """
        url, write_id = event["url"], event["writeId"]
        if self.tag.mode != "dynamic":
            log.info("nfc.write ignored, tag mode is %s", self.tag.mode)
            return
        try:
            await asyncio.to_thread(self.tag.write_url, url)
        except (NfcTagError, OSError, NotImplementedError) as e:
            log.exception("nfc write failed")
            await self.send(nfc_failed(write_id, str(e) or type(e).__name__))
            return
        self.last_nfc_url = url
        await self.send(nfc_written(write_id, url))

    # ---------- LED helpers ----------

    def _show_idle(self) -> None:
        self.player.play("idle", anim.idle(self.leds, self.idle_rgb))

    def _show_offline(self) -> None:
        self.player.play("offline", anim.idle(self.leds, anim.OFFLINE_RGB, period_s=2.0))


async def run_agent(cfg: Config) -> None:
    """Build hardware from config and run the agent until cancelled.

    TODO:
    - install SIGTERM/SIGINT handlers (loop.add_signal_handler) that call agent.stop()
      so systemd stop turns the LEDs off cleanly
    """
    leds = make_strip(cfg.leds)
    tag = make_tag(cfg.nfc)
    agent = KioskAgent(cfg, leds, tag)
    try:
        await agent.run()
    finally:
        await agent.stop()
