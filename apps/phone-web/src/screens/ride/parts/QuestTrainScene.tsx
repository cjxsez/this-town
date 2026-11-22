import type { LineColor } from "../../../../shared/types";

/** The trolley, drawn by the start screen's renderer (public/art/sprite-trolley.webp). */
export function TrolleySprite({ line = "green", width = 560 }: { line?: LineColor; width?: number }) {
  return (
    <img
      src={`/art/sprite-trolley-${line}.webp`}
      alt=""
      style={{ display: "block", flex: "none", width, maxWidth: "none", height: "auto", marginBottom: -width * 0.03 }}
    />
  );
}

/** F3's tunnel: ceiling lights, the train pulling in, the rail and the platform edge. */
export function QuestTrainScene({ line = "green" }: { line?: LineColor }) {
  return (
    <div aria-hidden style={{ position: "relative", height: "100%", minHeight: 260, background: "var(--ink)", overflow: "hidden" }}>
      {["15%", "49%", "83%"].map((l) => (
        <div key={l} style={{ position: "absolute", left: l, top: 22, width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)" }} />
      ))}
      {/* Negative delay: the first frame (and the paused frame with motion off) is the train parked at the platform. */}
      <div className="anim-trainIn" style={{ position: "absolute", left: -160, bottom: 150, display: "flex", gap: 8, animationDelay: "-3.4s" }}>
        <TrolleySprite line={line} />
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
