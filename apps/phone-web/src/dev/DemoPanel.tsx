import { useState } from "react";
import { useLocation } from "react-router";
import { sim } from "../api";
import { useApp } from "../state/store";

/**
 * Floating controls for judging and design review, mock mode only. Stands in for what the
 * train and the other rider do on their own: a match, them leaving or tapping the tag, a
 * delay, a dead spot, the next stop.
 */
export function DemoPanel() {
  const { state, actions } = useApp();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  if (!sim || !state.settings.demoPanel || pathname.startsWith("/screens")) return null;
  const d = sim.demo;
  const phase = state.ride.phase;
  const btn = (label: string, fn: () => void, on?: boolean) => (
    <button
      type="button"
      onClick={() => {
        fn();
        force((n) => n + 1);
      }}
      style={{
        padding: "6px 8px",
        borderRadius: 6,
        border: "2px solid var(--ink)",
        background: on ? "var(--leaf)" : "var(--paper)",
        font: "400 10px/1.1 var(--font-display)",
        textTransform: "uppercase",
        textAlign: "center",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ position: "absolute", right: 4, top: "48%", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        type="button"
        aria-label="Demo controls"
        onClick={() => setOpen((o) => !o)}
        style={{ width: 28, height: 28, borderRadius: "50%", border: "2px dashed var(--ink)", background: "rgba(244,245,236,.7)", opacity: open ? 1 : 0.55, font: "400 10px var(--font-display)" }}
      >
        {open ? "×" : "D"}
      </button>
      {open && (
        <div style={{ width: 176, padding: 8, borderRadius: 10, background: "rgba(244,245,236,.96)", border: "2px solid var(--ink)", boxShadow: "3px 4px 0 var(--shadow)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          <div className="q-eyebrow" style={{ gridColumn: "1 / -1" }}>Demo · {phase}</div>
          {btn("Match now", () => d.matchNow())}
          {btn("They left", () => d.partnerLeaves())}
          {btn("They tap tag", () => d.partnerTaps())}
          {btn("Time's up", () => d.timeUp())}
          {btn("Next stop", () => d.nextStop())}
          {btn(d.delayed ? "Delay: on" : "Delay: off", () => d.setDelayed(!d.delayed), d.delayed)}
          {btn(d.online ? "Signal: on" : "Signal: off", () => d.setOnline(!d.online), !d.online)}
          {btn(d.autoplay ? "Autoplay: on" : "Autoplay: off", () => (d.autoplay = !d.autoplay), d.autoplay)}
          {btn(state.profile?.glassesLinked ? "Glasses: on" : "Glasses: off", () => actions.updateProfile({ glassesLinked: !state.profile?.glassesLinked }), state.profile?.glassesLinked)}
          {btn("Hide panel", () => actions.setSettings({ demoPanel: false }))}
          {btn("Reset all", () => void actions.deleteMyData())}
        </div>
      )}
    </div>
  );
}
