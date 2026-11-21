import type { CSSProperties } from "react";
import { AnimalToken, Hint, Screen } from "../../ui";
import { useRide } from "../../state/store";
import { useNow } from "../../state/useNow";
import { clock, secondsUntil } from "../../state/format";
import { badgeFor } from "../../../shared/catalog";
import type { Badge } from "../../../shared/types";
import { BumpQuestBar } from "./parts/BumpQuestBar";

/** Both taps must land within this window (wireframe: 20 seconds). */
const BUMP_WINDOW_S = 20;

const badgeStyle: CSSProperties = { border: "3px solid var(--ink)", boxShadow: "3px 6px 0 var(--shadow)" };

/** One badge hanging from its lanyard, swinging in toward the middle. */
function BumpBadge({ badge, side }: { badge: Badge; side: "L" | "R" }) {
  return (
    <div
      className={side === "L" ? "anim-bumpL" : "anim-bumpR"}
      style={{
        position: "absolute",
        left: side === "L" ? "calc(50% - 143px)" : "calc(50% + 19px)",
        top: -8,
        width: 124,
        transformOrigin: "50% 0",
      }}
    >
      <div style={{ width: 4, height: 104, margin: "0 auto", background: "var(--ink)" }} />
      <AnimalToken badge={badge} size={124} style={badgeStyle} />
    </div>
  );
}

/** Spark lines that flash where the badges meet. */
function BumpBurst() {
  const sparks: [number, number, string][] = [
    [0, 18, "var(--yellow)"],
    [180, 18, "var(--yellow)"],
    [35, 14, "var(--paper)"],
    [-35, 14, "var(--paper)"],
    [145, 14, "var(--paper)"],
    [-145, 14, "var(--paper)"],
  ];
  return (
    <div className="anim-burst" style={{ position: "absolute", left: "50%", top: 158, width: 0, height: 0 }}>
      {sparks.map(([deg, h, bg]) => (
        <div
          key={deg}
          style={{
            position: "absolute",
            left: -3,
            top: -40,
            width: 6,
            height: h,
            boxSizing: "border-box",
            borderRadius: 3,
            background: bg,
            border: "2px solid var(--ink)",
            transformOrigin: "3px 40px",
            transform: `rotate(${deg}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function Bump() {
  const { ride, act, profile } = useRide();
  const now = useNow();
  const m = ride.match;
  const bump = ride.bump;
  const you = !!bump?.you;
  const partner = !!bump?.partner;
  const secs = secondsUntil(bump?.deadline, now);
  const frac = Math.min(1, secs / BUMP_WINDOW_S);
  const name = m?.firstName ?? "them";

  // A second tap never gives a second stamp: once you've bumped, the button is done.
  const onBump = () => {
    if (!you) act.bump();
  };

  return (
    <Screen label="G1" blobs="a">
      <BumpQuestBar />

      <div aria-hidden style={{ position: "relative", height: 236, flex: "none", margin: "0 calc(-1 * var(--gutter))" }}>
        <BumpBadge badge={profile.badge ?? badgeFor(23)} side="L" />
        {m && <BumpBadge badge={m.badge} side="R" />}
        <BumpBurst />
      </div>

      <h1 style={{ font: "400 34px/1.02 var(--font-display)", textAlign: "center", textTransform: "uppercase" }}>Bump badges</h1>
      <p style={{ fontSize: 21, lineHeight: 1.2, textWrap: "pretty", textAlign: "center" }}>
        Touch the two badges together, then both tap Bump.
      </p>
      {profile.hasGlasses && (
        <Hint style={{ textAlign: "center", color: "var(--onsea)", marginTop: -6 }}>Your glasses can see both tags, so the tap is optional.</Hint>
      )}

      {/* The big round button: easy to hit with gloves on. */}
      <div style={{ position: "relative", height: 150, flex: "none" }}>
        {!you && (
          <div
            className="anim-pulse"
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              marginLeft: -75,
              top: 0,
              width: 150,
              height: 150,
              boxSizing: "border-box",
              borderRadius: "50%",
              border: "3px solid var(--ink)",
            }}
          />
        )}
        <button
          type="button"
          onClick={onBump}
          aria-pressed={you}
          aria-label={you ? "Bumped" : "Bump"}
          style={{
            position: "absolute",
            left: "50%",
            marginLeft: -75,
            top: 0,
            width: 150,
            height: 150,
            boxSizing: "border-box",
            borderRadius: "50%",
            background: you ? "var(--leaf)" : "var(--yellow)",
            color: "var(--ink)",
            border: "3px solid var(--ink)",
            boxShadow: `inset 0 -10px 0 ${you ? "var(--green)" : "var(--yellow-dk)"}, 3px 6px 0 var(--shadow)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `400 ${you ? 24 : 30}px var(--font-display)`,
            cursor: you ? "default" : "pointer",
            translate: you ? "0 3px" : undefined,
          }}
        >
          {you ? "✓ BUMPED" : "BUMP"}
        </button>
      </div>

      <div
        style={{
          background: "var(--paper)",
          color: "var(--ink)",
          border: "var(--ol) solid var(--ink)",
          borderRadius: "var(--r1)",
          padding: "10px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          font: "700 21px var(--font-hand)",
        }}
        aria-live="polite"
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>You</span>
          <span>{you ? "✓ bumped" : "waiting"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>{name}</span>
          <span className="q-num">
            {partner ? "✓ bumped" : "waiting"} · <span role="timer">{clock(secs)}</span> left
          </span>
        </div>
        <div
          aria-hidden
          style={{
            height: 10,
            boxSizing: "border-box",
            border: "var(--ol) solid var(--ink)",
            borderRadius: 5,
            overflow: "hidden",
            background: "var(--paper-lo)",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "var(--rust)",
              transformOrigin: "0 50%",
              transform: `scaleX(${frac})`,
              transition: "transform .25s linear",
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
