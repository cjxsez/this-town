import { useState, type CSSProperties } from "react";
import { DIRECTIONS, LINES } from "../../../shared/catalog";
import type { CheckIn as CheckInData, Direction, GreenBranch, LineColor } from "../../../shared/types";
import { useApp, useRide } from "../../state/store";
import { Card, Eyebrow, Screen, Segmented, Title } from "../../ui";
import { PlatformBlobs, PlatformQuestsToggle, stationFor } from "./parts/PlatformKit";
import { PlatformKenmoreMap } from "./parts/PlatformKenmoreMap";
import { PlatformStationSheet } from "./parts/PlatformStationSheet";

const pickLine = (lines: LineColor[], want?: LineColor) => (want && lines.includes(want) ? want : lines[0]);
const pickBranch = (branches: GreenBranch[] | undefined, want?: GreenBranch) =>
  branches?.length ? (want && branches.includes(want) ? want : branches[0]) : undefined;
const pickDirection = (line: LineColor, want?: Direction["id"]) =>
  DIRECTIONS[line].some((d) => d.id === want) ? want! : DIRECTIONS[line][0].id;

/** C1: Ride Mode off. Pick station, line and direction, then flip quests on. */
export default function CheckIn() {
  const { ride, act, profile } = useRide();
  const { state, actions } = useApp();
  const prev = ride.checkIn;

  const [stationId, setStationId] = useState(prev?.stationId ?? profile.homeStation);
  const station = stationFor(stationId);
  const [line, setLine] = useState<LineColor>(pickLine(station.lines, prev?.line));
  const [branch, setBranch] = useState<GreenBranch | undefined>(pickBranch(station.branches, prev?.branch));
  const [direction, setDirection] = useState<Direction["id"]>(pickDirection(line, prev?.direction));
  const [via, setVia] = useState<CheckInData["via"]>(prev?.via ?? "list");
  const [picking, setPicking] = useState(false);

  const branches = line === "green" ? station.branches : undefined;

  const chooseStation = (id: string) => {
    const s = stationFor(id);
    const l = pickLine(s.lines, line);
    setStationId(s.id);
    setLine(l);
    setBranch(pickBranch(l === "green" ? s.branches : undefined, branch));
    setDirection(pickDirection(l, direction));
    setVia("list");
    setPicking(false);
  };

  const chooseLine = (l: LineColor) => {
    setLine(l);
    setBranch(pickBranch(l === "green" ? station.branches : undefined, branch));
    setDirection(pickDirection(l, direction));
  };

  const goOn = () => {
    act.checkIn({ stationId: station.id, line, branch: line === "green" ? branch : undefined, direction, via });
    // Ghost is "for this ride"; a new check-in is a new ride.
    if (state.settings.ghost) actions.setSettings({ ghost: false });
  };

  const multiLine = station.lines.length > 1;

  return (
    <Screen label="C1" tabs blobs={false}>
      <PlatformBlobs blobs={[[120, 110, 330, 200], [-80, 60, 240, 130]]} />
      <Title style={{ fontSize: 34 }}>Where are you riding?</Title>

      <Card style={{ gap: 8 }}>
        <Eyebrow>Station</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ font: "400 24px/1.02 var(--font-display)", minWidth: 0, textTransform: "uppercase" }}>{station.name}</div>
          <button
            type="button"
            onClick={() => setPicking(true)}
            aria-haspopup="dialog"
            aria-label={`Change station${via === "beacon" ? ", found via station beacon" : ""}`}
            className="q-pill"
            style={{ background: "var(--sky)", borderRadius: "var(--r3)", minHeight: 44, cursor: "pointer", flex: "0 1 auto", whiteSpace: "normal", textAlign: "center", lineHeight: 1.2, padding: "4px 10px" }}
          >
            {via === "beacon" ? "VIA BEACON · CHANGE" : "CHANGE"}
          </button>
        </div>

        {station.id === "kenmore" && (
          <div style={{ padding: "4px 0" }}>
            <PlatformKenmoreMap branch={line === "green" ? branch : undefined} name={station.name} />
          </div>
        )}

        <Eyebrow>Line</Eyebrow>
        {multiLine && (
          <Segmented
            label="Line"
            value={line}
            onChange={chooseLine}
            options={station.lines.map((l) => ({
              value: l,
              label: (
                <>
                  <span aria-hidden style={dot(LINES[l].hex)} />
                  {LINES[l].label}
                </>
              ),
            }))}
          />
        )}
        {branches && branch ? (
          <Segmented
            label="Green Line branch"
            value={branch}
            onChange={setBranch}
            options={branches.map((b) => ({ value: b, label: b === branch && !multiLine ? `Green ${b}` : b }))}
          />
        ) : (
          !multiLine && (
            <Segmented
              label="Line"
              value={line}
              onChange={chooseLine}
              options={[{ value: line, label: LINES[line].label }]}
            />
          )
        )}

        <Eyebrow>Direction</Eyebrow>
        <div role="radiogroup" aria-label="Direction" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DIRECTIONS[line].map((d, i) => {
            const on = d.id === direction;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setDirection(d.id)}
                style={{
                  minHeight: 46,
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "var(--ol) solid var(--ink)",
                  borderRadius: i % 2 ? "var(--r2)" : "var(--r1)",
                  background: on ? "var(--sky)" : "var(--paper-hi)",
                  font: "700 20px/1.1 var(--font-hand)",
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: "none",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "var(--ol) solid var(--ink)",
                    background: on ? "var(--ink)" : "var(--paper-hi)",
                  }}
                />
                <span>
                  {d.label} · {d.towards}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <PlatformQuestsToggle on={false} onToggle={goOn} label="Quests" />

      {picking && <PlatformStationSheet current={station.id} onPick={chooseStation} onClose={() => setPicking(false)} />}
    </Screen>
  );
}

const dot = (bg: string): CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: bg,
  border: "1.5px solid var(--ink)",
});
