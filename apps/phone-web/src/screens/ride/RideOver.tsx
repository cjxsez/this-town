import { LINES } from "../../../shared/catalog";
import type { LineColor } from "../../../shared/types";
import { lineProgress } from "../../state/progress";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useApp, useRide } from "../../state/store";
import { Body, Button, LinePill, Screen, Title, TrainPill } from "../../ui";
import { lineName, stationFor, TrolleySprite } from "./parts/PlatformKit";
import { PlatformScene3D, PlatformSign } from "./parts/PlatformScene3D";

/**
 * C4: Ride Mode is off. Confirms it, says why (your stop, you turned it off, end of the
 * line) and what you got out of the ride.
 */
export default function RideOver() {
  const { ride, act } = useRide();
  const { state } = useApp();
  const navigate = useNavigate();
  const frame = useRef<HTMLDivElement>(null);
  const [flat, setFlat] = useState(false);
  const c = ride.checkIn;
  const station = stationFor(c?.destinationId);
  const lineHex = LINES[c?.line ?? "green"].hex;
  const progress = c ? lineProgress(state.stamps, c.line, c.branch) : undefined;
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
      backdrop={<PlatformScene3D line={c?.line} mode="arrive" frameRef={frame} onStatus={(s) => setFlat(s === "failed")} />}
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
      <div className="q-topbar">
        {c ? <LinePill line={c.line}>{lineName(c).toUpperCase()}</LinePill> : <span />}
        <TrainPill>RIDE MODE OFF</TrainPill>
      </div>

      {/* Room for the trolley, which pulls in at your stop and stays (full-screen behind the page). */}
      <div ref={frame} style={{ flex: "1 0 auto", minHeight: 220, position: "relative", margin: "0 calc(-1 * var(--gutter))" }}>
        {flat ? <RideOverFlatScene line={c?.line} /> : <PlatformSign name={c?.destinationName ?? station.name} color={lineHex} style={{ right: 16, top: 6 }} />}
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
