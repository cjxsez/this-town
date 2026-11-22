import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useApp } from "../../state/store";
import { ArtSlot, BackLink, Button, Card, Hint, Screen, Toggle, TileTitle } from "../../ui";

/** Small status pill: "CONNECTED" (leaf) or "NOT CONNECTED" (paper). */
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

function SettingRow({ title, sub, children }: { title: string; sub: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ font: "700 23px/1.08 var(--font-hand)" }}>{title}</div>
        <div style={{ fontSize: 17, lineHeight: 1.2, color: "var(--ink-soft)" }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

export default function Glasses() {
  const { state, actions } = useApp();
  const g = state.glasses;
  const navigate = useNavigate();
  const [pairing, setPairing] = useState(false);

  // Pairing is simulated in the web build; the real link lives in the iPhone app.
  useEffect(() => {
    if (!pairing) return;
    const t = setTimeout(() => {
      actions.setGlasses({ connected: true });
      actions.updateProfile({ hasGlasses: true });
      setPairing(false);
    }, 1200);
    return () => clearTimeout(t);
  }, [pairing, actions]);

  const start = () => {
    actions.setGlasses({ sessionLive: true, lastCardAt: Date.now() });
    navigate("/me/glasses/live");
  };

  return (
    <Screen
      label="J1"
      blobs={false}
      footer={
        g.connected ? (
          <Button onClick={start}>
            Start session
          </Button>
        ) : (
          <Button onClick={() => setPairing(true)} disabled={pairing}>
            {pairing ? "Connecting…" : "Connect"}
          </Button>
        )
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
      <Card style={{ gap: 4, }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="q-title--sm">{g.model}</div>
          {g.connected ? <StatusPill>CONNECTED</StatusPill> : <StatusPill tone="paper">{pairing ? "PAIRING…" : "NOT CONNECTED"}</StatusPill>}
        </div>
        <div style={{ fontSize: 18, lineHeight: 1.2, color: "var(--ink-soft)" }} aria-live="polite">
          {g.connected ? `Battery ${g.battery}% · ${g.neuralBand ? "Neural Band paired" : "Neural Band not paired"}` : "Not connected"}
        </div>
      </Card>
      <Card>
        <SettingRow title="Read badges with camera" sub="7 fps · frames checked for a tag, then thrown away">
          <Toggle checked={g.readBadges} onChange={(v) => actions.setGlasses({ readBadges: v })} label="Read badges with camera" />
        </SettingRow>
        <div style={{ borderTop: "2px dashed var(--stone)" }} />
        <SettingRow title="Nod to accept" sub="Experimental">
          <Toggle checked={g.nodToAccept} onChange={(v) => actions.setGlasses({ nodToAccept: v })} label="Nod to accept (experimental)" />
        </SettingRow>
      </Card>
      <Hint style={{ color: "var(--onsea)", fontSize: 16 }}>
        In production this lives in the iPhone app. On the web it's a simulation.
      </Hint>
    </Screen>
  );
}
