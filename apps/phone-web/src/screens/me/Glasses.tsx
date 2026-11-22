import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../../state/store";
import { ArtSlot, BackLink, Body, Button, Card, Hint, Screen, TileTitle } from "../../ui";
import LinkGlasses from "./LinkGlasses";

/** Small status pill: "LINKED" (leaf) or "NOT LINKED" (paper). */
export function StatusPill({ children, tone = "leaf" }: { children: ReactNode; tone?: "leaf" | "paper" | "ink" }) {
  const bg = tone === "leaf" ? "var(--leaf)" : tone === "ink" ? "var(--ink)" : "var(--paper)";
  return (
    <span className="q-pill" style={{ background: bg, color: tone === "ink" ? "var(--paper)" : "var(--ink)", borderRadius: "var(--r4)" }}>
      {children}
    </span>
  );
}

export const GlassesTag = () => (
  <span
    style={{
      font: "400 10px var(--font-display)",
      letterSpacing: ".06em",
      padding: "3px 6px",
      border: "1.5px solid var(--ink)",
      borderRadius: 4,
      background: "var(--sky)",
      color: "var(--ink)",
    }}
  >
    GLASSES
  </span>
);

/**
 * J1 Glasses. The glasses run the In This Town Web App and link to this rider with a 4-digit
 * code. They need no input: match, where to go, mission and stamp all appear on their own.
 * No camera, no mic.
 */
export default function Glasses() {
  const { state } = useApp();
  const navigate = useNavigate();
  const linked = !!state.profile?.glassesLinked;
  const [relink, setRelink] = useState(false);

  // Not linked yet, or linking different ones: the form. Back goes to Me, or back to these glasses.
  if (!linked || relink) {
    return <LinkGlasses onBack={relink ? () => setRelink(false) : () => navigate("/me")} onLinked={() => setRelink(false)} />;
  }

  return (
    <Screen
      label="J1"
      blobs={false}
      footer={
        <Button variant="secondary" onClick={() => setRelink(true)}>
          Link different glasses
        </Button>
      }
    >
      <div className="q-blob" style={{ left: 120, top: 110, width: 330, height: 200, borderRadius: "46% 54% 60% 40%/55% 45% 55% 45%" }} />
      <div className="q-blob" style={{ left: -80, top: 60, width: 240, height: 130, borderRadius: "58% 42% 45% 55%/45% 60% 40% 55%" }} />
      <div className="q-topbar">
        <BackLink to="/me">Me</BackLink>
        <GlassesTag />
      </div>
      <TileTitle text="GLASSES" />
      <div style={{ flex: "1 0 110px", minHeight: 110, color: "var(--ink)", display: "flex" }}>
        <ArtSlot id="glasses-art" fit="contain" placeholder="glasses illustration" style={{ width: "100%", flex: 1 }} />
      </div>
      <Card style={{ gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="q-title--sm">Meta Ray-Ban Display</div>
          <StatusPill>LINKED</StatusPill>
        </div>
        <Body style={{ margin: 0 }}>Open In This Town on your glasses and keep it open while you ride. It shows your match, where to meet, the mission and your stamp.</Body>
      </Card>
      <Card style={{ gap: 6 }}>
        <Body style={{ margin: 0 }}>Nothing to press. If the side of the frame works for you, swipe to move and tap to pick.</Body>
        <Hint>The glasses never use their camera or microphone for In This Town.</Hint>
      </Card>
    </Screen>
  );
}
