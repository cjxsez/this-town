import { LINES, LINE_STATION_COUNT, stationById } from "../../../shared/catalog";
import type { CheckIn, GreenBranch, LineColor, Stamp } from "../../../shared/types";
import { useNavigate } from "react-router";
import { useApp, useRide } from "../../state/store";
import { Body, Button, LinePill, Screen, Title, TrainPill } from "../../ui";
import { lineName, stationFor, TrolleySprite } from "./parts/PlatformKit";
import { PlatformScene3D, PlatformSign } from "./parts/PlatformScene3D";

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

/**
 * C4: Ride Mode is off. Confirms it, says why (your stop, you turned it off, end of the
 * line) and what you got out of the ride.
 */
export default function RideOver() {
  const { ride, act } = useRide();
  const { state } = useApp();
  const navigate = useNavigate();
  const c = ride.checkIn;
  const station = stationFor(c?.destinationId);
  const lineHex = LINES[c?.line ?? "green"].hex;
  const progress = c ? lineProgress(state.stamps, c) : undefined;
  const why =
    ride.rideOverReason === "you"
      ? "You turned it off. Nobody can be matched with you until you tap a kiosk again."
      : ride.rideOverReason === "tripEnded"
        ? "This train reached the end of the line."
        : `You're at ${c?.destinationName ?? station.name}.`;
  const got =
    ride.stampsThisRide > 0
      ? `${ride.stampsThisRide} stamp${ride.stampsThisRide === 1 ? "" : "s"} and ${ride.peopleThisRide} new ${ride.peopleThisRide === 1 ? "person" : "people"} this ride.`
      : ride.peopleThisRide > 0
        ? `You met ${ride.peopleThisRide} ${ride.peopleThisRide === 1 ? "person" : "people"} this ride.`
        : "No quest this ride. That's most rides.";

  return (
    <Screen
      label="C4"
      tabs
      blobs={false}
      footer={
        <>
          <Button onClick={act.closeRideOver}>
            Done
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              act.closeRideOver();
              navigate("/passport");
            }}
          >
            See passport
          </Button>
        </>
      }
    >
      <div className="q-blob" style={{ left: -40, top: 130, width: 340, height: 190, borderRadius: "46% 54% 60% 40%/55% 45% 55% 45%" }} />
      <div className="q-blob" style={{ left: 230, top: 60, width: 230, height: 130, borderRadius: "58% 42% 45% 55%/45% 60% 40% 55%" }} />

      <div className="q-topbar">
        {c ? <LinePill line={c.line}>{lineName(c).toUpperCase()}</LinePill> : <span />}
        <TrainPill>RIDE MODE OFF</TrainPill>
      </div>

      {/* The trolley pulls in at your stop and stays. */}
      <div style={{ flex: "1 0 auto", minHeight: 200, position: "relative", margin: "0 calc(-1 * var(--gutter))" }}>
        <PlatformScene3D line={c?.line} mode="arrive" fallback={<RideOverFlatScene line={c?.line} />} style={{ position: "absolute", inset: 0 }}>
          <PlatformSign name={c?.destinationName ?? station.name} color={lineHex} style={{ right: 16, top: 12 }} />
        </PlatformScene3D>
      </div>

      <div role="status" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Title>Ride Mode is off.</Title>
        <Body style={{ fontSize: 21 }}>{why}</Body>
        <Body style={{ fontSize: 21 }}>{got}</Body>
        {c && progress && (
          <Body>
            {lineName(c)} stamps: {progress.got} / {progress.total}
          </Body>
        )}
      </div>
    </Screen>
  );
}

/** The flat tunnel scene, shown when the 3D scene cannot run. */
function RideOverFlatScene({ line }: { line?: LineColor }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, background: "var(--ink)", overflow: "hidden" }}>
      {["15%", "49%", "83%"].map((l) => (
        <div key={l} style={{ position: "absolute", left: l, top: 22, width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)" }} />
      ))}
      {/* Negative delay: the first frame (and the paused frame with motion off) shows the train at the platform. */}
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
