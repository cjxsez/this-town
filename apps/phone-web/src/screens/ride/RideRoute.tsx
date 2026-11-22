import { Navigate } from "react-router";
import { useApp } from "../../state/store";
import type { RidePhase } from "../../state/ride";
import type { ComponentType } from "react";
import CheckIn from "./CheckIn";
import Riding from "./Riding";
import Offline from "./Offline";
import RideOver from "./RideOver";
import FellThrough from "./FellThrough";
import Meet from "./Meet";
import Mission from "./Mission";
import Stamp from "./Stamp";
import Recap from "./Recap";

const BY_PHASE: Record<RidePhase, ComponentType> = {
  off: CheckIn,
  riding: Riding,
  fellThrough: FellThrough,
  meet: Meet,
  mission: Mission,
  stamp: Stamp,
  recap: Recap,
  rideOver: RideOver,
};

/**
 * /ride renders whatever phase the server last put the rider in. There are no
 * per-phase URLs on purpose: the back button can't resurrect a dead match.
 */
export default function RideRoute() {
  const { state } = useApp();
  if (!state.profile) return <Navigate to="/" replace />;
  const { phase, online } = state.ride;
  const Phase = phase === "riding" && !online ? Offline : BY_PHASE[phase];
  return <Phase />;
}
