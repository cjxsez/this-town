/**
 * Home.tsx: route "/". Ride Mode status.
 *
 * Responsible for the three states of RideState.status (from useRide):
 * - off:                "Tap the kiosk in your car to start" (+ link glasses prompt).
 * - riding:             car, next stop + ETA, riders on train, ghost toggle, end ride.
 * - matched/in-mission: partner first name, pair color, where to go (meetAtCar/carDelta/
 *                       youWalk), the "why you two" line, mission countdown, report link.
 *
 * Uses:
 * - Events (via useRide): ride.state, match.found, match.cleared, mission.start, mission.end,
 *   stamp.awarded.
 * - PUT /api/ride/ghost { ghost }  (GhostReq)
 * - POST /api/ride/end
 * - GET /api/me (glassesLinked) for the "link your glasses" nudge.
 *
 * TODO:
 * - Optional "Not now" button sending rider.notNow (glasses pinch is the primary path).
 * - Toast for lastCleared reasons ("Maya had to go, finding someone else").
 * - Celebrate lastStamp when stamp.awarded arrives.
 * - Confirm dialog on End ride.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { RideState } from "@questline/protocol";
import { Countdown } from "../components/Countdown";
import { PairColorBadge } from "../components/PairColorBadge";
import { api, errorMessage } from "../lib/api";
import { applyRideState, resetRide, useRide, type CurrentMatch } from "../lib/useRide";

export function Home() {
  const { connection, state, stateAt, match, mission } = useRide();
  const [glassesLinked, setGlassesLinked] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMe()
      .then((me) => setGlassesLinked(me.glassesLinked))
      .catch(() => setGlassesLinked(null));
  }, []);

  if (!state || state.status === "off") {
    return (
      <section className="stack">
        <h1>Ride Mode is off</h1>
        <p className="muted">Tap the kiosk in your car to start.</p>
        {glassesLinked === false && (
          <Link className="btn" to="/link">
            Link your glasses
          </Link>
        )}
        <p className="muted small">Connection: {connection}</p>
      </section>
    );
  }

  async function toggleGhost(current: RideState) {
    setError(null);
    try {
      await api.setGhost(!current.ghost);
      applyRideState({ ...current, ghost: !current.ghost });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function endRide() {
    setError(null);
    try {
      await api.endRide();
      resetRide();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <section className="stack">
      <h1>{match ? `You're matched with ${match.partner.firstName}` : "Ride Mode is on"}</h1>

      {match ? (
        <MatchPanel match={match} />
      ) : (
        <p className="muted">
          {state.ghost
            ? "Ghost mode: you're hidden from matching."
            : "Looking for the closest rider who shares your interests."}
        </p>
      )}

      {mission && (
        <article className="card">
          <h3>{mission.title}</h3>
          <p>{mission.prompt}</p>
          <Countdown endsAt={mission.endsAt} label="Time left" />
        </article>
      )}

      <dl className="facts">
        <dt>Car</dt>
        <dd>{state.car ?? "?"}</dd>
        <dt>Next stop</dt>
        <dd>
          {state.nextStop ?? "?"}
          {state.nextStopEtaSec !== null && (
            <>
              {" "}
              in <Countdown endsAt={stateAt + state.nextStopEtaSec * 1000} />
            </>
          )}
        </dd>
        <dt>Getting off at</dt>
        <dd>{state.destinationStop ?? "?"}</dd>
        <dt>Riders on train</dt>
        <dd>{state.ridersOnTrain}</dd>
      </dl>

      <label className="row">
        <input type="checkbox" checked={state.ghost} onChange={() => void toggleGhost(state)} />
        Ghost mode
      </label>
      <button className="btn danger" onClick={() => void endRide()}>
        End ride
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function MatchPanel({ match }: { match: CurrentMatch }) {
  return (
    <article className="card stack">
      <p>
        Look for <PairColorBadge color={match.partner.color} /> at {whereToGo(match)}
      </p>
      <p className="muted">{match.why}</p>
      <Link className="small" to={`/report/${encodeURIComponent(match.matchId)}`}>
        Report or block
      </Link>
    </article>
  );
}

/** carDelta: 0 same car, -1 one car back, +2 two cars forward. */
function whereToGo(match: CurrentMatch): string {
  const name = match.partner.firstName;
  if (match.carDelta === 0) return `the kiosk in your car. ${name} is in here too.`;
  if (!match.youWalk) return `your car's kiosk. ${name} is coming to you.`;
  const n = Math.abs(match.carDelta);
  const dir = match.carDelta < 0 ? "back" : "forward";
  return `the kiosk ${n} car${n === 1 ? "" : "s"} ${dir} (car ${match.meetAtCar}).`;
}
