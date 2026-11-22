"""Integration: KioskAgent against a local websockets server (no real sleeps beyond short timeouts)."""

from __future__ import annotations

import asyncio
import json

from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

from questline_kiosk.agent import KioskAgent, WS_CLOSE_GOING_AWAY, WS_CLOSE_TRIP_CHANGED
from questline_kiosk.config import AgentConfig, Config, LedConfig, NfcConfig, with_fake_hardware
from questline_kiosk.leds import FakeLeds
from questline_kiosk.nfc_tag import FakeTag

WRITE_ID = "write-abc"
TAG_URL = "https://example.test/k/1412?n=nonce1"


def _close_code(exc: ConnectionClosed) -> int | None:
    if exc.rcvd is not None:
        return exc.rcvd.code
    if exc.sent is not None:
        return exc.sent.code
    return None


async def _run() -> None:
    hellos: list[dict] = []
    written: list[dict] = []
    phase = {"n": 0}

    hello1 = asyncio.Event()
    written_ok = asyncio.Event()
    hello2 = asyncio.Event()
    closed_1001 = asyncio.Event()

    async def handler(ws) -> None:
        phase["n"] += 1
        session = phase["n"]
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
            msg = json.loads(raw)
            hellos.append(msg)
            if session == 1:
                hello1.set()
                await ws.send(json.dumps({"type": "nfc.write", "writeId": WRITE_ID, "url": TAG_URL}))
                while True:
                    raw2 = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    reply = json.loads(raw2)
                    if reply.get("type") == "ping":
                        continue
                    written.append(reply)
                    written_ok.set()
                    break
                await ws.close(WS_CLOSE_TRIP_CHANGED, "trip changed")
                return

            hello2.set()
            try:
                async for _ in ws:
                    pass
            except ConnectionClosed as e:
                if _close_code(e) == WS_CLOSE_GOING_AWAY:
                    closed_1001.set()
                return
            # Normal end: client closed; websockets may set close_code on the connection.
            code = getattr(ws, "close_code", None)
            if code == WS_CLOSE_GOING_AWAY:
                closed_1001.set()
        except ConnectionClosed as e:
            if _close_code(e) == WS_CLOSE_GOING_AWAY:
                closed_1001.set()

    async with serve(handler, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        cfg = with_fake_hardware(
            Config(
                domain=f"127.0.0.1:{port}",
                car="1412",
                kiosk_key="test-key",
                tls=False,
                leds=LedConfig(enabled=True, driver="fake", count=4, brightness=1.0, idle_color="#8fb4ff"),
                nfc=NfcConfig(mode="dynamic", chip="fake"),
                agent=AgentConfig(
                    ping_interval_s=30.0,
                    reconnect_min_s=0.01,
                    reconnect_max_s=0.05,
                    celebrate_s=0.05,
                ),
            )
        )
        leds = FakeLeds(cfg.leds.count, cfg.leds.brightness, max_fps=0)
        agent = KioskAgent(cfg, leds, FakeTag())
        run_task = asyncio.create_task(agent.run())

        await asyncio.wait_for(hello1.wait(), timeout=2.0)
        assert hellos[0]["type"] == "kiosk.hello"
        assert hellos[0]["car"] == "1412"
        assert hellos[0]["role"] == "pi"
        assert hellos[0]["hw"] == {"leds": True, "nfc": "dynamic"}

        await asyncio.wait_for(written_ok.wait(), timeout=2.0)
        assert written[0]["type"] == "nfc.written"
        assert written[0]["writeId"] == WRITE_ID
        assert written[0]["url"] == TAG_URL

        await asyncio.wait_for(hello2.wait(), timeout=2.0)
        assert len(hellos) >= 2
        assert hellos[1]["type"] == "kiosk.hello"

        await agent.stop()
        await asyncio.wait_for(run_task, timeout=2.0)
        assert run_task.done()
        await asyncio.wait_for(closed_1001.wait(), timeout=1.0)


def test_agent_hello_nfc_trip_changed_and_shutdown():
    asyncio.run(_run())
