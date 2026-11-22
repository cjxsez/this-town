import type { CSSProperties, ReactNode } from "react";
import { LINES } from "../../../../shared/catalog";
import type { LineColor } from "../../../../shared/types";

/** "GREEN B · WEST" for the ticket header. */
export function stampLineLabel(line: LineColor, branch?: string, car?: string) {
  const c = car ? ` · CAR ${car}` : "";
  return `${line.toUpperCase()}${branch ? ` ${branch}` : ""}${c}`;
}

export function stampDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })} ${d.getFullYear()}`;
}

const BARCODE_LG =
  "repeating-linear-gradient(90deg,var(--ink) 0 3px,#0000 3px 5px,var(--ink) 5px 6px,#0000 6px 9px,var(--ink) 9px 12px,#0000 12px 14px)";
const BARCODE_SM =
  "repeating-linear-gradient(90deg,var(--ink) 0 2px,#0000 2px 4px,var(--ink) 4px 5px,#0000 5px 7px,var(--ink) 7px 10px,#0000 10px 12px)";

/** Paper ticket outline: scalloped edges, two punch notches at the tear line, inked edge and offset shadow. */
function TicketShape({
  stub,
  edgeR,
  edgeStep,
  notchR,
  ol,
  shadow,
  rare,
  children,
}: {
  stub: number;
  edgeR: number;
  edgeStep: number;
  notchR: number;
  ol: number;
  shadow: string;
  rare?: boolean;
  children: ReactNode;
}) {
  const half = edgeStep / 2;
  const mask = [
    `radial-gradient(circle at 0 ${half}px,#0000 ${edgeR}px,#000 ${edgeR + 0.5}px) 0 0/100% ${edgeStep}px`,
    `radial-gradient(circle at 100% ${half}px,#0000 ${edgeR}px,#000 ${edgeR + 0.5}px) 0 0/100% ${edgeStep}px`,
    `radial-gradient(circle at ${stub}px 0,#0000 ${notchR}px,#000 ${notchR + 0.5}px)`,
    `radial-gradient(circle at ${stub}px 100%,#0000 ${notchR}px,#000 ${notchR + 0.5}px)`,
  ].join(",");
  const ink = "var(--ink)";
  return (
    <div
      style={{
        height: "100%",
        filter: `drop-shadow(${ol}px 0 0 ${ink}) drop-shadow(-${ol}px 0 0 ${ink}) drop-shadow(0 ${ol}px 0 ${ink}) drop-shadow(0 -${ol}px 0 ${ink}) drop-shadow(${shadow} var(--shadow))`,
      }}
    >
      <div
        style={{
          height: "100%",
          display: "flex",
          background: rare ? "var(--yellow)" : "var(--ticket)",
          color: "var(--ink)",
          mask,
          maskComposite: "intersect",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Little train drawn on the big ticket, roof in the line colour. */
function TicketTrain({ line }: { line: LineColor }) {
  return (
    <div style={{ flex: "none", width: 104 }} aria-hidden>
      <div
        style={{
          height: 30,
          boxSizing: "border-box",
          background: "#D9DED3",
          border: "2px solid var(--ink)",
          borderRadius: "12px 5px 3px 3px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, background: LINES[line].hex }} />
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            top: 11,
            height: 9,
            boxSizing: "border-box",
            background: "repeating-linear-gradient(90deg,#62C1BC 0 12px,#D9DED3 12px 16px)",
            border: "1.5px solid var(--ink)",
          }}
        />
      </div>
      <div style={{ borderTop: "2px solid var(--ink)", marginTop: 4 }} />
      <div style={{ height: 4, background: "repeating-linear-gradient(90deg,var(--ink) 0 2px,#0000 2px 9px)" }} />
    </div>
  );
}

/** The G2 station ticket, 350 × 160 at full size; shrinks its stub on narrow phones. */
export function StampTicketLarge({
  station,
  lineLabel,
  line,
  date,
  withName,
  rare,
  number,
  style,
}: {
  station: string;
  lineLabel: string;
  line: LineColor;
  date: string;
  withName: string;
  rare: boolean;
  number?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ height: 160, rotate: "-5deg", filter: "var(--wob)", ...style }}>
      <TicketShape stub={246} edgeR={6} edgeStep={20} notchR={9} ol={2} shadow="5px 7px 0" rare={rare}>
        <div style={{ flex: "none", width: 246, boxSizing: "border-box", padding: "14px 12px 0 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              font: "400 10px var(--font-display)",
              letterSpacing: ".06em",
            }}
          >
            <span>QUESTLINE</span>
            <span>{lineLabel}</span>
          </div>
          <div
            style={{
              font: `400 ${station.length > 10 ? 22 : 30}px/1 var(--font-display)`,
              marginTop: 8,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {station}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 12 }}>
            <TicketTrain line={line} />
            <div style={{ font: "700 16px/1.15 var(--font-hand)" }}>
              {date}
              <br />
              with {withName}
            </div>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
            borderLeft: "2.5px dashed var(--ink)",
            padding: "16px 20px 0 14px",
          }}
        >
          <div style={{ height: 70, background: BARCODE_LG }} />
          <div style={{ font: "400 11px var(--font-display)", letterSpacing: ".06em", marginTop: 8, whiteSpace: "nowrap" }}>
            {rare ? "★ RARE" : "COMMON"}
          </div>
          {number !== undefined && (
            <div style={{ font: "700 15px var(--font-hand)", whiteSpace: "nowrap" }}>No. {String(number).padStart(4, "0")}</div>
          )}
        </div>
      </TicketShape>
    </div>
  );
}

/** The H1 recap stub, 176 × 64. */
export function StampTicketSmall({
  station,
  sub,
  rare,
  style,
}: {
  station: string;
  sub: string;
  rare: boolean;
  style?: CSSProperties;
}) {
  return (
    <div style={{ flex: "none", width: 176, height: 64, rotate: "-1.5deg", filter: "var(--wob)", ...style }}>
      <TicketShape stub={124} edgeR={3.5} edgeStep={12.8} notchR={6} ol={1.5} shadow="3px 4px 0" rare={rare}>
        <div style={{ flex: "none", width: 124, boxSizing: "border-box", padding: "10px 6px 0 14px" }}>
          <div style={{ font: "400 15px/1 var(--font-display)", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden" }}>
            {station}
          </div>
          <div style={{ font: "700 15px/1.1 var(--font-hand)", marginTop: 5 }}>{sub}</div>
        </div>
        <div style={{ flex: 1, boxSizing: "border-box", borderLeft: "2px dashed var(--ink)", padding: "10px 10px 0 7px" }}>
          <div style={{ height: 24, background: BARCODE_SM }} />
          <div style={{ font: "400 8px var(--font-display)", marginTop: 5, whiteSpace: "nowrap" }}>{rare ? "★ RARE" : "COMMON"}</div>
        </div>
      </TicketShape>
    </div>
  );
}
