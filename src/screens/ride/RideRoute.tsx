import { Navigate } from "react-router";
import { useApp } from "../../state/store";
import type { RidePhase } from "../../state/ride";
import type { ComponentType } from "react";
import CheckIn from "./CheckIn";
import Waiting from "./Waiting";
import Offline from "./Offline";
import NoMatch from "./NoMatch";
import Offer from "./Offer";
import OfferWaiting from "./OfferWaiting";
import FellThrough from "./FellThrough";
import Meet from "./Meet";
import CantSpot from "./CantSpot";
import Greeting from "./Greeting";
import Mission from "./Mission";
import TrainSoon from "./TrainSoon";
import Bump from "./Bump";
import Stamp from "./Stamp";
import Photo from "./Photo";
import Keep from "./Keep";
import Recap from "./Recap";

const BY_PHASE: Record<RidePhase, ComponentType> = {
  off: CheckIn,
  waiting: Waiting,
  noMatch: NoMatch,
  offer: Offer,
  offerYes: OfferWaiting,
  fellThrough: FellThrough,
  meet: Meet,
  cantSpot: CantSpot,
  greeting: Greeting,
  mission: Mission,
  bump: Bump,
  stamp: Stamp,
  photo: Photo,
  keep: Keep,
  recap: Recap,
};

/**
 * /ride renders whatever phase the server last put the rider in. There are no
 * per-phase URLs on purpose: the back button can't resurrect a dead offer.
 */
export default function RideRoute() {
  const { state } = useApp();
  if (!state.profile) return <Navigate to="/" replace />;
  const { phase, online, trainSoon } = state.ride;
  const Phase = phase === "waiting" && !online ? Offline : BY_PHASE[phase];
  return (
    <>
      <Phase />
      {trainSoon && <TrainSoon />}
    </>
  );
}
