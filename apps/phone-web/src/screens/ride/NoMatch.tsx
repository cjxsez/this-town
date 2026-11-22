import { LINES, LINE_STATION_COUNT, stationById } from "../../../shared/catalog";
import type { CheckIn, GreenBranch, LineColor, Stamp } from "../../../shared/types";
import { useApp, useRide } from "../../state/store";
import { Body, Button, LinePill, Screen, Title, TrainPill } from "../../ui";
import { lineName, stationFor } from "./parts/PlatformKit";
import { PlatformScene3D, PlatformSign } from "./parts/PlatformScene3D";
import { TrolleySprite } from "./parts/QuestTrainScene";

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
          <Button variant="secondary" onClick={turnOff}>
            Turn quests off
          </Button>
          <Button onClick={act.keepOnNextStation}>
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

      {/* the train pulls in, without you on a quest */}
      <div style={{ flex: "1 0 auto", minHeight: 200, position: "relative", margin: "0 calc(-1 * var(--gutter))" }}>
        <PlatformScene3D line={c?.line} mode="arrive" fallback={<NoMatchFlatScene line={c?.line} />} style={{ position: "absolute", inset: 0 }}>
          <PlatformSign name={station.name} color={LINES[c?.line ?? "green"].hex} style={{ right: 16, top: 12 }} />
        </PlatformScene3D>
      </div>

      <Title>No quest this time</Title>
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

/** The flat tunnel scene, shown when the 3D scene cannot run. */
function NoMatchFlatScene({ line }: { line?: LineColor }) {
  return (
    <div
      aria-hidden
      style={{ position: "absolute", inset: 0, background: "var(--ink)", overflow: "hidden" }}
    >
      {["15%", "49%", "83%"].map((l) => (
        <div key={l} style={{ position: "absolute", left: l, top: 22, width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)" }} />
      ))}
      {/* Negative delay, as on F3: the first frame (and the paused frame with motion off) shows the train at the platform. */}
      <div className="anim-trainIn" style={{ position: "absolute", left: -160, bottom: 70, display: "flex", gap: 8, animationDelay: "-3.4s" }}>
        <TrolleySprite line={line} width={420} />
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
  );
}
