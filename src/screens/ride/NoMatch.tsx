import { LINES, LINE_STATION_COUNT, stationById } from "../../../shared/catalog";
import type { CheckIn, GreenBranch, Stamp } from "../../../shared/types";
import { useApp, useRide } from "../../state/store";
import { Body, Button, LinePill, Screen, Title, TrainPill } from "../../ui";
import { lineName, stationFor } from "./parts/PlatformKit";

/** Stops per Green Line branch, trunk included (Gov't Ctr out to the end of the branch). */
const BRANCH_STOPS: Record<GreenBranch, number> = { B: 23, C: 19, D: 19, E: 18 };

/** Distinct stations stamped on this line (and branch, for the Green Line). */
function lineProgress(stamps: Stamp[], c: CheckIn) {
  const ids = new Set(
    stamps
      .filter((s) => s.line === c.line)
      .filter((s) => {
        if (c.line !== "green" || !c.branch) return true;
        const st = stationById(s.stationId);
        return !st?.branches || st.branches.includes(c.branch);
      })
      .map((s) => s.stationId),
  );
  const total = c.line === "green" && c.branch ? BRANCH_STOPS[c.branch] : LINE_STATION_COUNT[c.line];
  return { got: ids.size, total };
}

/** C4: the train came and nobody was a match. Never reads as rejection. */
export default function NoMatch() {
  const { ride, act } = useRide();
  const { state, actions } = useApp();
  const c = ride.checkIn;
  const station = stationFor(c?.stationId);
  const lineHex = LINES[c?.line ?? "green"].hex;
  const hasHere = state.stamps.some((s) => s.stationId === station.id);
  const progress = c ? lineProgress(state.stamps, c) : undefined;
  const [shortA, shortB] = station.short.includes("-") ? [station.short.split("-")[0] + "-", station.short.split("-").slice(1).join("-")] : [station.short, ""];

  const turnOff = () => {
    act.checkOut();
    if (state.settings.ghost) actions.setSettings({ ghost: false });
  };

  return (
    <Screen
      label="C4"
      tabs
      blobs={false}
      footer={
        <>
          <Button variant="secondary" tilt={0.6} onClick={turnOff}>
            Turn quests off
          </Button>
          <Button tilt={-0.7} onClick={act.keepOnNextStation}>
            Keep on for the next station
          </Button>
        </>
      }
    >
      <div className="q-blob" style={{ left: -40, top: 130, width: 340, height: 190, borderRadius: "46% 54% 60% 40%/55% 45% 55% 45%" }} />
      <div className="q-blob" style={{ left: 230, top: 60, width: 230, height: 130, borderRadius: "58% 42% 45% 55%/45% 60% 40% 55%" }} />

      <div className="q-topbar">
        {c ? <LinePill line={c.line}>{lineName(c).toUpperCase()}</LinePill> : <span />}
        <TrainPill>ARRIVING</TrainPill>
      </div>

      {/* the train pulls in and out, without you on a quest */}
      <div
        aria-hidden
        style={{ flex: "1 0 auto", minHeight: 200, position: "relative", margin: "0 calc(-1 * var(--gutter))", background: "var(--ink)", overflow: "hidden" }}
      >
        {["15%", "49%", "83%"].map((l) => (
          <div key={l} style={{ position: "absolute", left: l, top: 22, width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)" }} />
        ))}
        <div className="anim-trainIn" style={{ position: "absolute", left: -160, bottom: 70, display: "flex", gap: 8 }}>
          <NoMatchCar lineHex={lineHex} />
          <NoMatchCar lineHex={lineHex} front />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 52, height: 10, background: "repeating-linear-gradient(90deg, var(--stone-dk) 0 18px, var(--ink) 18px 24px)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 40, background: "var(--stone)", borderTop: "2.5px solid var(--ink)" }}>
          <div
            style={{
              height: 16,
              background: "radial-gradient(circle, var(--yellow-dk) 3px, transparent 3.5px) 0 0/14px 16px, var(--yellow)",
              borderBottom: "2.5px solid var(--ink)",
            }}
          />
        </div>
      </div>

      <Title style={{ fontSize: 40 }}>No quest this time</Title>
      <Body style={{ fontSize: 21 }}>Nobody heading your way was a match. That's most rides.</Body>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          aria-hidden
          style={{
            flex: "none",
            width: 52,
            height: 74,
            border: hasHere ? "var(--ol) solid var(--ink)" : "2px dashed var(--stone-dk)",
            background: hasHere ? "var(--ticket)" : undefined,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            font: "400 10px/1.15 var(--font-display)",
            color: hasHere ? "var(--ink)" : "var(--ink-soft)",
          }}
        >
          {shortA}
          {shortB && <br />}
          {shortB}
        </div>
        <div>
          <div style={{ font: "700 23px/1.08 var(--font-hand)" }}>{hasHere ? 1 : 0} of 1 stamps</div>
          {c && progress && (
            <Body>
              {lineName(c)} {progress.got} / {progress.total}
            </Body>
          )}
        </div>
      </div>
    </Screen>
  );
}

function NoMatchCar({ lineHex, front }: { lineHex: string; front?: boolean }) {
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
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ width: 38, height: 30, borderRadius: 6, background: "#62C1BC", border: "2.5px solid var(--ink)" }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 56, height: 14, background: lineHex }} />
      {front && (
        <div style={{ position: "absolute", right: 10, top: 74, width: 14, height: 14, borderRadius: "50%", background: "var(--yellow)", border: "2.5px solid var(--ink)" }} />
      )}
      <div style={{ position: "absolute", left: 36, bottom: -9, width: 20, height: 20, borderRadius: "50%", background: "var(--stone-dk)" }} />
      <div style={{ position: "absolute", right: 36, bottom: -9, width: 20, height: 20, borderRadius: "50%", background: "var(--stone-dk)" }} />
    </div>
  );
}
