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
         stamp.progress (tapped: 1) -> short white flash, then back to pulse
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
import signal
from collections.abc import Iterator

from . import animations as anim
from .config import Config
from .leds import LedStrip, make_strip
from .nfc_tag import NfcTag, NfcTagError, make_tag
from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosed, InvalidStatus, WebSocketException

from .protocol import (
    CelebrateEvent,
    KioskIdleEvent,
    KioskToServer,
    MissionShowEvent,
    NfcWriteEvent,
    PairClearedEvent,
    PairColor,
    PairIncomingEvent,
    ProtocolError,
    ServerToKiosk,
    StampProgressEvent,
    encode,
    hex_to_rgb,
    kiosk_hello,
    nfc_failed,
    nfc_written,
    pair_rgb,
    parse_server_event,
    ping,
)

log = logging.getLogger(__name__)

# A connection that lasted this long resets the backoff.
STABLE_CONNECTION_S = 30.0

# Worker close codes (packages/protocol WS_CLOSE).
WS_CLOSE_BAD_AUTH = 4001
WS_CLOSE_TRIP_CHANGED = 4002
WS_CLOSE_FORBIDDEN = 4003
WS_CLOSE_GOING_AWAY = 1001


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
        """Connect forever until stop() is called."""
        delays = backoff_delays(self.cfg.agent.reconnect_min_s, self.cfg.agent.reconnect_max_s)
        loop = asyncio.get_running_loop()

        while not self._stopping.is_set():
            started = loop.time()
            close_code: int | None = None
            try:
                async with connect(
                    self.cfg.ws_url,
                    open_timeout=10,
                    ping_interval=20,
                    ping_timeout=20,
                    max_size=64 * 1024,
                ) as ws:
                    await self._session(ws)
            except asyncio.CancelledError:
                raise
            except InvalidStatus as e:
                # Never log cfg.ws_url: it contains the kiosk key.
                status = getattr(getattr(e, "response", None), "status_code", None) or getattr(
                    e, "status_code", None
                )
                log.error(
                    "kiosk socket rejected (HTTP %s): bad key or car — check config.toml",
                    status,
                )
                close_code = WS_CLOSE_BAD_AUTH if status in (401, 403) else None
            except ConnectionClosed as e:
                close_code = e.code
                log.warning("kiosk socket closed code=%s reason=%r", e.code, e.reason)
            except (OSError, WebSocketException, TimeoutError, asyncio.TimeoutError) as e:
                log.warning("kiosk socket error: %s: %s", type(e).__name__, e)

            if self._stopping.is_set():
                break

            lived = loop.time() - started
            if lived >= STABLE_CONNECTION_S:
                delays = backoff_delays(self.cfg.agent.reconnect_min_s, self.cfg.agent.reconnect_max_s)

            self._show_offline()

            if close_code == WS_CLOSE_TRIP_CHANGED:
                wait_s = 0.0
                log.info("trip changed; reconnecting immediately")
            elif close_code in (WS_CLOSE_BAD_AUTH, WS_CLOSE_FORBIDDEN):
                wait_s = self.cfg.agent.reconnect_max_s
                log.error("auth/forbidden (code %s); waiting %.0fs before retry", close_code, wait_s)
            else:
                wait_s = next(delays)

            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=wait_s)
            except asyncio.TimeoutError:
                pass

    async def _session(self, ws: ClientConnection) -> None:
        """One connected session: hello, ping loop, read loop.

        LEDs keep their current state on reconnect; the server resends kiosk
        state after the next kiosk.hello (see protocol.md).
        """
        self._ws = ws
        ping_task = asyncio.create_task(self._ping_loop(), name="kiosk-ping")
        try:
            await self.send(
                kiosk_hello(self.cfg.car, leds=self.cfg.leds.enabled, nfc=self.tag.mode)
            )
            log.info("sent kiosk.hello car=%s nfc=%s", self.cfg.car, self.tag.mode)
            async for raw in ws:
                try:
                    event = parse_server_event(raw)
                except ProtocolError as e:
                    log.warning("dropping bad server event: %s", e)
                    continue
                if event is None:
                    continue  # unknown type (e.g. pong) — ignore
                await self.dispatch(event)
        finally:
            ping_task.cancel()
            try:
                await ping_task
            except asyncio.CancelledError:
                pass
            self._ws = None

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
        ws = self._ws
        if ws is not None:
            try:
                await ws.close(WS_CLOSE_GOING_AWAY, "shutdown")
            except Exception:
                log.debug("socket close during shutdown failed", exc_info=True)
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
                await self.on_stamp_progress(event)  # type: ignore[arg-type]

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

    async def on_stamp_progress(self, event: StampProgressEvent) -> None:
        """First tap: short white flash, then resume the mission pulse."""
        if self.active_match not in (None, event["matchId"]):
            log.info(
                "stamp.progress for %s but showing %s, ignoring",
                event["matchId"],
                self.active_match,
            )
            return
        if event["tapped"] != 1 or self.active_color is None:
            return

        color = self.active_color

        async def flash_then_pulse() -> None:
            await anim.flash(self.leds, anim.WHITE, duration_s=0.18)
            await anim.pulse(self.leds, pair_rgb(color))

        # Named "pulse" because that is the lasting state after the flash.
        self.player.play("pulse", flash_then_pulse())

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

        Retries and read-back verify live in the chip writers (nfc_tag.py).
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
    """Build hardware from config and run the agent until cancelled."""
    leds = make_strip(cfg.leds)
    tag = make_tag(cfg.nfc)
    agent = KioskAgent(cfg, leds, tag)

    loop = asyncio.get_running_loop()

    def _on_signal(signame: str) -> None:
        log.info("received %s, shutting down", signame)
        asyncio.create_task(agent.stop())

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _on_signal, sig.name)
        except (NotImplementedError, RuntimeError):
            # Windows / embedded loops may not support add_signal_handler.
            pass

    try:
        await agent.run()
    finally:
        await agent.stop()
