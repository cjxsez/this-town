"""Event-to-animation mapping tests using FakeLeds."""

from __future__ import annotations

import asyncio
from dataclasses import replace

from questline_kiosk.agent import KioskAgent
from questline_kiosk.config import Config, LedConfig, NfcConfig, with_fake_hardware
from questline_kiosk.leds import FakeLeds
from questline_kiosk.nfc_tag import FakeTag
from questline_kiosk.protocol import pair_rgb


def _cfg() -> Config:
    return with_fake_hardware(
        Config(
            domain="localhost:8787",
            car="1412",
            kiosk_key="test-key",
            tls=False,
            leds=LedConfig(enabled=True, driver="fake", count=8, brightness=1.0, idle_color="#8fb4ff"),
            nfc=NfcConfig(mode="dynamic", chip="fake"),
        )
    )


def _agent() -> tuple[KioskAgent, FakeLeds]:
    cfg = _cfg()
    leds = FakeLeds(cfg.leds.count, cfg.leds.brightness, max_fps=0)
    agent = KioskAgent(cfg, leds, FakeTag())
    return agent, leds


def _run(coro):
    return asyncio.run(coro)


async def _settle(seconds: float = 0.05) -> None:
    await asyncio.sleep(seconds)


def test_pair_incoming_sets_solid_pair_color():
    async def body() -> None:
        agent, leds = _agent()
        await agent.dispatch(
            {
                "type": "pair.incoming",
                "matchId": "m1",
                "color": "orange",
                "firstNames": ["Ada", "Bo"],
                "arrived": 0,
            }
        )
        await _settle()
        assert agent.active_match == "m1"
        assert agent.player.current == "solid"
        assert all(px == pair_rgb("orange") for px in leds.pixels)
        await agent.player.stop()

    _run(body())


def test_mission_show_starts_pulse():
    async def body() -> None:
        agent, leds = _agent()
        await agent.dispatch(
            {
                "type": "mission.show",
                "matchId": "m1",
                "color": "green",
                "mission": {
                    "sessionId": "s1",
                    "templateId": "t1",
                    "category": "spot",
                    "title": "Look",
                    "prompt": "Find it",
                    "endsAt": 0,
                    "rare": False,
                },
                "serverNow": 0,
            }
        )
        await _settle(0.08)
        assert agent.player.current == "pulse"
        assert any(px[1] > 0 for px in leds.pixels)
        await agent.player.stop()

    _run(body())


def test_kiosk_idle_ignored_while_pair_active():
    async def body() -> None:
        agent, _ = _agent()
        await agent.dispatch(
            {
                "type": "pair.incoming",
                "matchId": "m1",
                "color": "blue",
                "firstNames": ["A", "B"],
                "arrived": 0,
            }
        )
        await agent.dispatch(
            {
                "type": "kiosk.idle",
                "ridersInCar": 2,
                "ridersOnTrain": 4,
                "nextStop": "Kenmore",
                "nextStopEtaSec": 90,
                "serverNow": 0,
            }
        )
        await _settle()
        assert agent.player.current == "solid"
        assert agent.active_match == "m1"
        await agent.player.stop()

    _run(body())


def test_pair_cleared_returns_to_idle_for_active_match():
    async def body() -> None:
        agent, _ = _agent()
        await agent.dispatch(
            {
                "type": "pair.incoming",
                "matchId": "m1",
                "color": "pink",
                "firstNames": ["A", "B"],
                "arrived": 0,
            }
        )
        await agent.dispatch({"type": "pair.cleared", "matchId": "m1"})
        await _settle(0.08)
        assert agent.active_match is None
        assert agent.player.current == "idle"
        await agent.player.stop()

    _run(body())


def test_pair_cleared_ignores_stale_match():
    async def body() -> None:
        agent, _ = _agent()
        await agent.dispatch(
            {
                "type": "pair.incoming",
                "matchId": "m2",
                "color": "yellow",
                "firstNames": ["A", "B"],
                "arrived": 0,
            }
        )
        await agent.dispatch({"type": "pair.cleared", "matchId": "m1"})
        await _settle()
        assert agent.active_match == "m2"
        assert agent.player.current == "solid"
        await agent.player.stop()

    _run(body())


def test_stamp_progress_flashes_then_pulses():
    async def body() -> None:
        agent, leds = _agent()
        await agent.dispatch(
            {
                "type": "mission.show",
                "matchId": "m1",
                "color": "purple",
                "mission": {
                    "sessionId": "s1",
                    "templateId": "t1",
                    "category": "spot",
                    "title": "Look",
                    "prompt": "Find it",
                    "endsAt": 0,
                    "rare": False,
                },
                "serverNow": 0,
            }
        )
        await agent.dispatch({"type": "stamp.progress", "matchId": "m1", "tapped": 1})
        await _settle(0.4)
        assert agent.player.current == "pulse"
        # Back on the purple pulse after the white flash.
        assert any(px[2] > 0 for px in leds.pixels)
        await agent.player.stop()

    _run(body())


def test_celebrate_plays_celebrate_animation():
    async def body() -> None:
        agent, _ = _agent()
        agent.cfg = replace(agent.cfg, agent=replace(agent.cfg.agent, celebrate_s=0.3))
        await agent.dispatch(
            {
                "type": "celebrate",
                "matchId": "m1",
                "color": "orange",
                "rare": False,
            }
        )
        await _settle(0.05)
        assert agent.player.current == "celebrate"
        await agent.player.stop()

    _run(body())
