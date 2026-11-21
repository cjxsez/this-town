import type { CSSProperties } from "react";
import { LINES } from "../../../../shared/catalog";
import type { LineColor } from "../../../../shared/types";

const WIN: CSSProperties = {
  width: 38,
  height: 30,
  borderRadius: 6,
  background: "var(--sea)",
  border: "2.5px solid var(--ink)",
  flex: "none",
};
const WHEEL = (side: "left" | "right"): CSSProperties => ({
  position: "absolute",
  [side]: 36,
  bottom: -9,
  width: 20,
  height: 20,
  borderRadius: "50%",
  background: "var(--stone-dk)",
});

function Car({ front, stripe }: { front?: boolean; stripe: string }) {
  return (
    <div
      style={{
        flex: "none",
        width: 270,
        height: 98,
        position: "relative",
        background: "var(--paper)",
        borderRadius: front ? "14px 30px 8px 8px" : "14px 14px 8px 8px",
      }}
    >
      <div style={{ position: "absolute", left: 14, right: front ? 30 : 14, top: 14, display: "flex", justifyContent: "space-between" }}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} style={WIN} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 56, height: 14, background: stripe }} />
      {front && (
        <div
          style={{
            position: "absolute",
            right: 10,
            top: 74,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "var(--yellow)",
            border: "2.5px solid var(--ink)",
          }}
        />
      )}
      <div style={WHEEL("left")} />
      <div style={WHEEL("right")} />
    </div>
  );
}

/** F3's tunnel: ceiling lights, the train pulling in, the rail and the platform edge. */
export function QuestTrainScene({ line = "green" }: { line?: LineColor }) {
  const stripe = LINES[line].hex;
  return (
    <div aria-hidden style={{ position: "relative", height: "100%", minHeight: 260, background: "var(--ink)", overflow: "hidden" }}>
      {["15%", "49%", "83%"].map((l) => (
        <div key={l} style={{ position: "absolute", left: l, top: 22, width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)" }} />
      ))}
      {/* Negative delay: the first frame (and the paused frame with motion off) is the train parked at the platform. */}
      <div className="anim-trainIn" style={{ position: "absolute", left: -160, bottom: 150, display: "flex", gap: 8, animationDelay: "-3.4s" }}>
        <Car stripe={stripe} />
        <Car stripe={stripe} front />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 132,
          height: 10,
          background: "repeating-linear-gradient(90deg, var(--stone-dk) 0 18px, var(--ink) 18px 24px)",
        }}
      />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: "var(--stone)", borderTop: "2.5px solid var(--ink)" }}>
        <div
          style={{
            height: 16,
            background: "radial-gradient(circle, var(--yellow-dk) 3px, transparent 3.5px) 0 0/14px 16px, var(--yellow)",
            borderBottom: "2.5px solid var(--ink)",
          }}
        />
      </div>
    </div>
  );
}
