import type { CSSProperties, ReactNode } from "react";
import type { LensCard as LensCardValue } from "../../../shared/types";
import { coarseTime } from "./lens";

// The 600×600 right-eye card, drawn at 300 and scaled. The display is
// additive (black = transparent), so it's light text on near-black: a title,
// one body line, a coarse timer, at most two buttons.
const SOFT = "#A9CDBF";

const title: CSSProperties = { font: "400 21px/1.12 var(--font-display)", textTransform: "uppercase", overflowWrap: "anywhere" };
const soft: CSSProperties = { color: SOFT };
const timer: CSSProperties = { font: "400 13px var(--font-display)", color: SOFT, marginTop: 6, textTransform: "uppercase" };
const pill: CSSProperties = {
  minHeight: 44,
  padding: "0 18px",
  display: "flex",
  alignItems: "center",
  boxSizing: "border-box",
  borderRadius: 22,
  font: "400 15px var(--font-display)",
};

function LensButtons({ yes, no }: { yes: string; no: string }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
      <div style={{ ...pill, background: "var(--mint)", color: "var(--ink-deep)" }}>{yes}</div>
      <div style={{ ...pill, border: "2px solid var(--mint)" }}>{no}</div>
    </div>
  );
}

function content(card: LensCardValue): ReactNode {
  switch (card.kind) {
    case "waiting":
      return (
        <>
          <div style={title}>{card.line}</div>
          <div style={title}>{card.direction}</div>
          <div style={soft}>Train in {card.trainIn}</div>
          <div style={soft}>Quests on</div>
        </>
      );
    case "offer":
      return (
        <>
          <div style={{ ...title, fontSize: card.why.length > 40 ? 18 : 21 }}>{card.why}</div>
          <div style={soft}>{card.minutes}-min quest?</div>
          <LensButtons yes="✓ YES" no="SKIP" />
        </>
      );
    case "meet":
      return (
        <>
          <div style={title}>Meet {card.name}</div>
          <div style={soft}>{card.badge}</div>
          <div style={soft}>{card.spot}</div>
          <div style={timer}>Train {card.train}</div>
        </>
      );
    case "greeting":
      return (
        <>
          <div style={title}>That's {card.name} ✓</div>
          <div style={soft}>Say:</div>
          <div style={{ font: "700 25px/1.1 var(--font-hand)" }}>“{card.opener}”</div>
          <div style={timer}>Train {card.train}</div>
        </>
      );
    case "mission":
      return (
        <>
          <div style={{ ...title, fontSize: card.title.length > 44 ? 18 : 21 }}>{card.title}</div>
          <div style={soft}>{card.left}</div>
          <div style={timer}>Train {card.train}</div>
        </>
      );
    case "stamp":
      return (
        <>
          <div style={title}>{card.station} stamp</div>
          <div style={soft}>+1 with {card.name}</div>
          {card.askPhoto && <div style={soft}>Snap a memory?</div>}
          {card.askPhoto && <LensButtons yes="YES" no="NO" />}
        </>
      );
    case "trainSoon":
      return (
        <>
          <div style={title}>Train in {coarseTime(card.seconds).replace(" left", "")}</div>
          <div style={soft}>Stamp saved</div>
        </>
      );
  }
}

/** Plain-text version for screen readers and the mirror's aria-label. */
export function lensText(card: LensCardValue): string {
  switch (card.kind) {
    case "waiting": return `${card.line} ${card.direction}. Train in ${card.trainIn}. Quests on.`;
    case "offer": return `${card.why}. ${card.minutes}-min quest? Yes or skip.`;
    case "meet": return `Meet ${card.name}. ${card.badge}. ${card.spot}. Train ${card.train}.`;
    case "greeting": return `That's ${card.name}. Say: ${card.opener}. Train ${card.train}.`;
    case "mission": return `${card.title}. ${card.left}. Train ${card.train}.`;
    case "stamp": return `${card.station} stamp. Plus one with ${card.name}.${card.askPhoto ? " Snap a memory? Yes or no." : ""}`;
    case "trainSoon": return `Train in ${coarseTime(card.seconds).replace(" left", "")}. Stamp saved.`;
  }
}

/** A lens-shaped frame; children are laid out at the 300px design size. */
export function LensFrame({ size = 300, label, children }: { size?: number; label: string; children: ReactNode }) {
  const k = size / 300;
  return (
    <div role="img" aria-label={label} style={{ flex: "none", width: size + 4 * k, height: size + 6 * k }}>
      <div
        style={{
          width: 300,
          height: 300,
          transform: `scale(${k})`,
          transformOrigin: "top left",
          boxSizing: "border-box",
          background: "var(--ink-deep)",
          color: "var(--mint)",
          border: "3px solid var(--ink)",
          borderRadius: 30,
          boxShadow: "4px 6px 0 var(--shadow)",
          padding: 26,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 8,
          overflow: "hidden",
          font: "400 23px/1.15 var(--font-hand)",
          textAlign: "left",
        }}
      >
        <div aria-hidden style={{ display: "contents" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LensCard({ card, size = 300 }: { card: LensCardValue; size?: number }) {
  return (
    <LensFrame size={size} label={`Lens card: ${lensText(card)}`}>
      {content(card)}
    </LensFrame>
  );
}
