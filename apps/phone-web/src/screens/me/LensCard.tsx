import type { CSSProperties, ReactNode } from "react";
import { PAIR_COLOR_HEX } from "@questline/protocol/colors";
import type { LensCard as LensCardValue, PairColor } from "../../../shared/types";

// A preview of the glasses-web HUD (apps/glasses-web), drawn at 300 and scaled from
// 600×600. The display is additive (black = transparent), so it's light text on
// near-black. The glasses need no input, so cards have no buttons.
const SOFT = "#A9CDBF";

const title: CSSProperties = { font: "400 21px/1.12 var(--font-display)", textTransform: "uppercase", overflowWrap: "anywhere" };
const soft: CSSProperties = { color: SOFT };
const timer: CSSProperties = { font: "400 13px var(--font-display)", color: SOFT, marginTop: 6, textTransform: "uppercase" };
function Swatch({ color }: { color: PairColor }) {
  return <span aria-hidden style={{ display: "inline-block", width: 22, height: 22, borderRadius: "50%", background: PAIR_COLOR_HEX[color], verticalAlign: "middle", marginRight: 8 }} />;
}

function content(card: LensCardValue): ReactNode {
  switch (card.kind) {
    case "link":
      return (
        <>
          <div style={soft}>Enter on your phone</div>
          <div style={{ font: "400 64px/1 var(--font-display)", letterSpacing: ".12em" }}>{card.code}</div>
        </>
      );
    case "riding":
      return (
        <>
          <div style={title}>Ride Mode on</div>
          <div style={soft}>
            {card.nextStop} in {card.nextIn}
          </div>
          <div style={soft}>{card.riders} riders on this train</div>
        </>
      );
    case "match":
      return (
        <>
          <div style={title}>
            <Swatch color={card.color} />
            {card.name}
          </div>
          <div style={{ ...title, fontSize: 18 }}>{card.where}</div>
          <div style={soft}>{card.why}</div>
          <div style={timer}>look for {card.color}</div>
        </>
      );
    case "mission":
      return (
        <>
          <div style={{ ...title, fontSize: card.title.length > 44 ? 18 : 21 }}>{card.title}</div>
          <div style={soft}>{card.left}</div>
          <div style={timer}>{card.tapped === 0 ? "both tap the tag to stamp" : `${card.tapped} of 2 tapped`}</div>
        </>
      );
    case "stamp":
      return (
        <>
          <div style={title}>{card.station} stamp</div>
          <div style={soft}>with {card.name}</div>
        </>
      );
  }
}

/** Plain-text version for screen readers and the mirror's aria-label. */
export function lensText(card: LensCardValue): string {
  switch (card.kind) {
    case "link": return `Link code ${card.code}. Enter it on your phone.`;
    case "riding": return `Ride Mode on. ${card.nextStop} in ${card.nextIn}. ${card.riders} riders on this train.`;
    case "match": return `${card.name}. ${card.where}. ${card.why}. Look for ${card.color}.`;
    case "mission": return `${card.title}. ${card.left}. ${card.tapped} of 2 tapped.`;
    case "stamp": return `${card.station} stamp with ${card.name}.`;
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
