/**
 * Idle.tsx (glasses-web): linked, waiting for a match.
 *
 * Driven by ride.state (RideState): nextStop, nextStopEtaSec (shown as a countdown),
 * ridersOnTrain, status, ghost. If Ride Mode is off, tells the rider to tap the kiosk tag.
 * Kept mostly empty: this screen is up for most of the ride.
 */
import type { RideState } from "@questline/protocol";
import { Countdown } from "../components/Countdown";
import type { SocketStatus } from "../lib/socket";

interface IdleProps {
  ride: RideState | null;
  /** Absolute epoch ms for the next stop, derived from nextStopEtaSec at receipt time. */
  nextStopAt: number | null;
  status: SocketStatus;
}

export function Idle({ ride, nextStopAt, status }: IdleProps) {
  if (!ride) {
    return (
      <main className="hud hud-center" aria-live="polite">
        <div className="hud-body">{status === "connecting" ? "Connecting…" : "Waiting for your ride…"}</div>
      </main>
    );
  }

  if (ride.status === "off") {
    return (
      <main className="hud hud-center" aria-live="polite">
        <div className="hud-title">Ride Mode is off</div>
        <div className="hud-body">Tap the kiosk tag in your car to start</div>
      </main>
    );
  }

  return (
    <main className="hud">
      <div className="hud-dim">Next stop</div>
      <div className="hud-title">{ride.nextStop ?? "…"}</div>
      {nextStopAt !== null && <Countdown endsAt={nextStopAt} className="countdown-md" />}
      <div className="hud-body">{ride.ridersOnTrain} riders on this train</div>
      <div className="hud-dim">{ride.ghost ? "Ghost mode on" : "Looking for your match…"}</div>
      {status === "polling" && <div className="hud-dim">Live updates limited</div>}
    </main>
  );
}
