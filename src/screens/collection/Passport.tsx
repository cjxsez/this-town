import { useState } from "react";
import { Card, Screen } from "../../ui";
import { useApp } from "../../state/store";
import { shortDate } from "../../state/format";
import { LINES, LINE_STATION_COUNT, PASSPORT_LAYOUT, stationById } from "../../../shared/catalog";
import type { LineColor, Stamp } from "../../../shared/types";
import { EarnedTicket, EmptyTicket } from "./parts";
import { TMap } from "./TMap";

type Filter = LineColor | "all";
const LINE_ORDER: LineColor[] = ["green", "red", "orange", "blue"];
const TILTS = [-1.5, 1.8, -2.1, 1.5, -1.2, 2];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Best stamp per station: a rare one wins, then the newest. */
function stampsByStation(stamps: Stamp[]): Map<string, Stamp> {
  const m = new Map<string, Stamp>();
  for (const s of stamps) {
    const cur = m.get(s.stationId);
    if (!cur || (s.rare && !cur.rare) || (s.rare === cur.rare && s.earnedAt > cur.earnedAt)) m.set(s.stationId, s);
  }
  return m;
}

export default function Passport() {
  const { state } = useApp();
  const [filter, setFilter] = useState<Filter>("green");
  const stamps = state.stamps;
  const byStation = stampsByStation(stamps);
  const rare = stamps.filter((s) => s.rare).length;

  const lines = filter === "all" ? LINE_ORDER : [filter];

  return (
    <Screen tabs label="H2">
      <div className="cl-head">
        <h1 className="cl-h1">PASSPORT</h1>
        <div className="cl-sub">
          {stamps.length === 0 ? "no stamps yet" : `${plural(stamps.length, "stamp")}${rare ? ` · ${rare} rare` : ""}`}
        </div>
      </div>

      <Card className="cl-map">
        <TMap stamps={stamps} />
      </Card>

      <div className="cl-filter" role="radiogroup" aria-label="Line">
        {[...LINE_ORDER, "all" as const].map((f) => {
          const on = f === filter;
          const hex = f === "all" ? "var(--ink)" : LINES[f].hex;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={on}
              className="cl-filter__opt"
              style={on ? { background: f === "all" ? "var(--ink)" : LINES[f].dark } : undefined}
              onClick={() => setFilter(f)}
            >
              {!on && <span className="cl-filter__dot" style={{ background: hex }} aria-hidden />}
              {f === "all" ? "All" : LINES[f].label}
            </button>
          );
        })}
      </div>

      {lines.map((line, i) => (
        <LineCard key={line} line={line} byStation={byStation} footnote={i === lines.length - 1} />
      ))}
    </Screen>
  );
}

function LineCard({ line, byStation, footnote }: { line: LineColor; byStation: Map<string, Stamp>; footnote: boolean }) {
  const onLine = [...byStation.values()].filter((s) => stationById(s.stationId)?.lines.includes(line));
  const rare = onLine.filter((s) => s.rare).length;
  let n = 0; // running ticket index, so tilts don't repeat per group

  return (
    <Card className="cl-line">
      <h2 className="cl-line__title" style={{ margin: 0 }}>
        {LINES[line].label} Line · {onLine.length} of {LINE_STATION_COUNT[line]} stations{rare ? ` · ${rare} rare` : ""}
      </h2>
      {PASSPORT_LAYOUT[line].map((g) => (
        <section key={g.group} aria-label={`${LINES[line].label} Line, ${g.group.toLowerCase()}`}>
          <div className="q-eyebrow">{g.group}</div>
          <div className="cl-group">
            <div className="cl-group__rail" style={{ background: LINES[line].hex }} />
            <div className="cl-group__row">
              {g.stationIds.map((id) => {
                const st = stationById(id);
                if (!st) return null;
                const stamp = byStation.get(id);
                const tilt = TILTS[n++ % TILTS.length];
                return (
                  <div className="cl-stop" key={id}>
                    <div className="cl-stop__dot" data-on={!!stamp} />
                    <div className="cl-stop__stem" />
                    {stamp ? (
                      <EarnedTicket
                        station={st}
                        to={`/passport/${stamp.id}`}
                        rare={stamp.rare}
                        isNew={shortDate(stamp.earnedAt) === "today"}
                        tilt={tilt}
                      />
                    ) : (
                      <EmptyTicket station={st} />
                    )}
                  </div>
                );
              })}
              {g.more && (
                <span className="cl-more" aria-label="and more stations">
                  …
                </span>
              )}
            </div>
          </div>
        </section>
      ))}
      {footnote && <p className="cl-foot">★ rare = earned during a delay or a late-bonus mission</p>}
    </Card>
  );
}
