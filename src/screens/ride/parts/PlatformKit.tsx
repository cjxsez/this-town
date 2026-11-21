// Shared pieces for the check-in, waiting and offer screens (C1–D4).
import type { CSSProperties, ReactNode } from "react";
import { DIRECTIONS, LINES, STATIONS, stationById } from "../../../../shared/catalog";
import type { CheckIn, LineColor, Station } from "../../../../shared/types";
import { clock, secondsUntil } from "../../../state/format";
import { useNow } from "../../../state/useNow";
import type { RideState } from "../../../state/ride";
import { LinePill, TrainPill } from "../../../ui";

/** "GREEN B" for a check-in. */
export function lineName(c: Pick<CheckIn, "line" | "branch"> | undefined): string {
  if (!c) return "";
  return `${LINES[c.line].label}${c.line === "green" && c.branch ? ` ${c.branch}` : ""}`;
}

export const directionOf = (c: CheckIn | undefined) =>
  c ? DIRECTIONS[c.line].find((d) => d.id === c.direction) ?? DIRECTIONS[c.line][0] : undefined;

/** "GREEN B · WESTBOUND" */
export function lineLabel(c: CheckIn | undefined): string {
  const dir = directionOf(c);
  return [lineName(c), dir?.label].filter(Boolean).join(" · ").toUpperCase();
}

/** Live "m:ss" until the train. */
export function useTrainClock(ride: RideState): string {
  const now = useNow();
  return clock(secondsUntil(ride.trainAt, now));
}

/** Live "m:ss" until an epoch-ms deadline. */
export function useCountdown(at: number | undefined): string {
  const now = useNow();
  return clock(secondsUntil(at, now));
}

/**
 * The top row on every ride screen: line + direction on the left, the train
 * countdown on the right. The train always wins, so it's always visible.
 */
export function PlatformTopBar({ ride, estimated }: { ride: RideState; estimated?: boolean }) {
  const t = useTrainClock(ride);
  const c = ride.checkIn;
  return (
    <div className="q-topbar">
      {c ? <LinePill line={c.line}>{lineLabel(c)}</LinePill> : <span />}
      {estimated ? (
        <TrainPill>
          <span aria-label={`Train in about ${t}, estimated`}>~{t}</span>
        </TrainPill>
      ) : ride.delayed ? (
        <TrainPill warn>DELAYED {t}</TrainPill>
      ) : (
        <TrainPill>TRAIN {t}</TrainPill>
      )}
    </div>
  );
}

/** The big pill switch: "QUESTS OFF" (C1) / "QUESTS ON" (C2). */
export function PlatformQuestsToggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label ?? "Quests"}
      onClick={onToggle}
      style={{
        minHeight: 58,
        width: "100%",
        display: "flex",
        flexDirection: on ? "row" : "row-reverse",
        alignItems: "center",
        justifyContent: "space-between",
        padding: on ? "0 6px 0 20px" : "0 20px 0 6px",
        borderRadius: 29,
        background: on ? "var(--leaf)" : "var(--paper-lo)",
        color: "var(--ink)",
        border: "var(--ol) solid var(--ink)",
        boxShadow: "3px 4px 0 var(--shadow)",
        font: "400 20px var(--font-display)",
        textAlign: "left",
      }}
    >
      <span aria-hidden>{on ? "QUESTS ON" : "QUESTS OFF"}</span>
      <span
        aria-hidden
        style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", background: "var(--paper)", border: "var(--ol) solid var(--ink)" }}
      />
    </button>
  );
}

/** Two ragged foam clouds behind the screen, at the design's exact spots. */
export function PlatformBlobs({ blobs }: { blobs: [number, number, number, number][] }) {
  const radii = ["46% 54% 60% 40%/55% 45% 55% 45%", "58% 42% 45% 55%/45% 60% 40% 55%"];
  return (
    <>
      {blobs.map(([left, top, width, height], i) => (
        <div key={i} className="q-blob" style={{ left, top, width, height, borderRadius: radii[i % 2] }} />
      ))}
    </>
  );
}

/** Small drifting foam puff inside an illustration. */
export function PlatformPuff({ style, delay }: { style: CSSProperties; delay?: number }) {
  return (
    <div
      className="anim-drift"
      style={{
        position: "absolute",
        zIndex: -1,
        borderRadius: "58% 42% 55% 45%/48% 60% 40% 52%",
        background: "var(--foam)",
        filter: "var(--rag)",
        animationDelay: delay ? `${delay}ms` : undefined,
        ...style,
      }}
    />
  );
}

/** Round tree from the platform scenes. */
export function PlatformTree({ size, style, float, delay }: { size: number; style: CSSProperties; float?: boolean; delay?: number }) {
  const inset = Math.round(size / 5);
  return (
    <div
      className={float ? "anim-float" : undefined}
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--green)",
        border: "var(--ol) solid var(--ink)",
        boxShadow: `inset -${inset}px -${inset - 1}px 0 var(--green-dk)`,
        animationDelay: delay ? `${delay}ms` : undefined,
        ...style,
      }}
    />
  );
}

/** Little house with a coloured roof. */
export function PlatformHouse({ w, h, roof, style }: { w: number; h: number; roof: string; style: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: w,
        height: h,
        background: "var(--paper)",
        border: "var(--ol) solid var(--ink)",
        boxShadow: `inset -${Math.round(w / 4)}px 0 0 var(--stone)`,
        filter: "var(--wob)",
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: -6, right: -6, top: -12, height: 12, background: roof, border: "var(--ol) solid var(--ink)" }} />
      <div style={{ position: "absolute", left: 7, top: 10, width: 8, height: 11, background: "var(--ink)" }} />
    </div>
  );
}

/**
 * A 402px-wide illustration stage, centred in the full-bleed scene so the
 * design's absolute positions hold on every phone width (edges just crop).
 */
export function PlatformStage({
  children,
  minHeight,
  style,
  flex = true,
}: {
  children: ReactNode;
  minHeight: number;
  style?: CSSProperties;
  flex?: boolean;
}) {
  return (
    <div
      aria-hidden
      style={{
        flex: flex ? "1 0 auto" : "none",
        position: "relative",
        margin: "0 calc(-1 * var(--gutter))",
        minHeight,
        overflow: "hidden",
        isolation: "isolate",
        ...style,
      }}
    >
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 402, marginLeft: -201 }}>{children}</div>
    </div>
  );
}

/** Ticket perforation across a card: dashed tear line with two notches. */
export function PlatformTear() {
  const notch: CSSProperties = {
    position: "absolute",
    top: -12,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "var(--sea)",
    border: "var(--ol) solid var(--ink)",
  };
  return (
    <div aria-hidden style={{ position: "relative", margin: "4px -18px", borderTop: "2.5px dashed var(--ink)" }}>
      <span style={{ ...notch, left: -12 }} />
      <span style={{ ...notch, right: -12 }} />
    </div>
  );
}

// ---- line geography for the platform scene ----

/** Stations in travel order for each line's first DIRECTIONS entry. */
const ROUTE: Record<LineColor, string[]> = {
  green: ["gov-ctr", "park-st", "arlington", "copley", "hynes", "kenmore", "blandford", "bu-east", "bu-central", "amory", "babcock"],
  red: ["downtown-crossing", "park-st", "harvard"],
  orange: ["downtown-crossing"],
  blue: ["gov-ctr", "aquarium"],
};

/** The next two stops ahead of the rider, nearest first (only ones in the catalog). */
export function nextStops(c: CheckIn | undefined): Station[] {
  if (!c) return [];
  let order = ROUTE[c.line]
    .map((id) => stationById(id))
    .filter((s): s is Station => !!s)
    .filter((s) => c.line !== "green" || !c.branch || !s.branches || s.branches.includes(c.branch));
  if (DIRECTIONS[c.line][0]?.id !== c.direction) order = [...order].reverse();
  const i = order.findIndex((s) => s.id === c.stationId);
  if (i < 0) return [];
  return order.slice(i + 1, i + 3);
}

export const stationFor = (id: string | undefined) => (id && stationById(id)) || STATIONS[0];
