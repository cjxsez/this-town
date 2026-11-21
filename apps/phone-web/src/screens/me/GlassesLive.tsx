import { useEffect } from "react";
import { useNavigate } from "react-router";
import { badgeName, stationById } from "../../../shared/catalog";
import { clock } from "../../state/format";
import { useApp } from "../../state/store";
import { useNow } from "../../state/useNow";
import { Button, Card, Eyebrow, Screen } from "../../ui";
import { GlassesTag, StatusPill } from "./Glasses";
import { lensCardFor, lensKey } from "./lens";
import { LensCard, LensFrame } from "./LensCard";

/** The display dims if nothing new arrives for this long. */
const DIM_AFTER = 20;

export default function GlassesLive() {
  const { state, actions } = useApp();
  const { ride, glasses: g, profile } = state;
  const navigate = useNavigate();
  const now = useNow();

  const stationName = stationById(ride.checkIn?.stationId ?? "")?.name ?? "this station";
  // A live session means a lens is in use, even if pairing was skipped in the web demo.
  const card = lensCardFor(ride, stationName, !!profile?.hasGlasses || g.connected || g.sessionLive, now);
  const key = lensKey(card);

  // Opening this page means the session is live (a reload ends sessions).
  useEffect(() => {
    if (!g.sessionLive) actions.setGlasses({ sessionLive: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every change is a full redraw sent over Bluetooth; restart the "last sent" clock.
  useEffect(() => {
    actions.setGlasses({ lastCardAt: Date.now() });
  }, [key, actions]);

  const sentAgo = Math.max(0, (now - (g.lastCardAt ?? now)) / 1000);
  const tag = ride.badgeVerified && ride.match ? `${badgeName(ride.match.badge)} · #${ride.match.badge.number} read` : null;
  const reader = g.cameraPaused ? "Badge reader: paused" : !g.readBadges ? "Badge reader: off" : tag ? `Badge reader: ${tag}` : "Badge reader: no tag in view";

  const end = () => {
    actions.setGlasses({ sessionLive: false, cameraPaused: false });
    navigate("/me/glasses");
  };

  return (
    <Screen
      label="J2"
      footer={
        <>
          <Button variant="secondary" tilt={-0.4} onClick={() => actions.setGlasses({ cameraPaused: !g.cameraPaused })} aria-pressed={g.cameraPaused}>
            {g.cameraPaused ? "Resume camera" : "Pause camera"}
          </Button>
          <Button variant="danger" tilt={0.8} onClick={end}>
            End session
          </Button>
        </>
      }
    >
      <div className="q-topbar">
        <StatusPill>SESSION LIVE</StatusPill>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <GlassesTag />
          <StatusPill tone={g.cameraPaused ? "paper" : "ink"}>{g.cameraPaused ? "Ⅱ CAMERA" : "● CAMERA"}</StatusPill>
        </div>
      </div>
      <Eyebrow style={{ color: "var(--onsea)" }}>ON YOUR LENS NOW</Eyebrow>
      <div style={{ display: "flex", justifyContent: "center" }} aria-live="polite">
        {card ? (
          <LensCard card={card} size={280} />
        ) : (
          <LensFrame size={280} label="Lens is clear">
            <div style={{ font: "400 21px/1.12 var(--font-display)", color: "#A9CDBF" }}>LENS CLEAR</div>
            <div style={{ color: "#A9CDBF" }}>Check in on Ride and your cards show up here.</div>
          </LensFrame>
        )}
      </div>
      <Card style={{ gap: 4, rotate: "0.5deg" }}>
        <div style={{ font: "700 23px/1.08 var(--font-hand)" }}>{reader}</div>
        <div className="q-num" style={{ fontSize: 17, lineHeight: 1.2, color: "var(--ink-soft)" }}>
          Last card sent {clock(Math.floor(sentAgo))} ago · {sentAgo >= DIM_AFTER ? "display may be dimmed" : `display may dim at ${clock(DIM_AFTER)}`}
        </div>
      </Card>
    </Screen>
  );
}
