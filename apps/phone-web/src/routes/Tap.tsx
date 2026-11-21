/**
 * Tap.tsx: the NFC landing route /k/:car?n=<nonce>.
 *
 * The kiosk tag holds https://<domain>/k/<car>?n=<nonce>. The phone reads it in the
 * background and opens this page in the browser. The worker decides what the tap means
 * (check-in, move car, stamp) from the rider's current state and the nonce.
 *
 * Responsible for:
 * - Reading :car and ?n= (nonce is absent on static-sticker fallback tags).
 * - If not onboarded: redirect to /onboarding?next=<this url>, which comes back here.
 * - POST /api/taps once per page load (StrictMode-safe), and handling every TapRes result:
 *     need-destination -> DestinationPicker, then POST /api/taps again with destinationStop
 *     checked-in       -> applyRideState, reconnect socket to the new trip, "You're in car X"
 *     moved-car        -> applyRideState, "Moved to car X"
 *     stamp-pending    -> "Waiting for your partner to tap"
 *     stamp-awarded    -> StampCard
 *     error            -> message
 *
 * Uses: POST /api/taps (TapReq -> TapRes). Updates useRide store; Home then shows the rest
 * from socket events (ride.state, match.found, stamp.awarded).
 *
 * TODO:
 * - Strip ?n= from the URL (history.replaceState) after the tap so a refresh does not re-tap.
 * - Auto-forward to Home after checked-in/moved-car (short delay).
 * - stamp-pending: listen for stamp.awarded on the socket and flip to the StampCard live.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CarId } from "@questline/protocol";
import { StampCard } from "../components/StampCard";
import { api, errorMessage, type TapResult } from "../lib/api";
import { hasToken, onboardingPath } from "../lib/auth";
import { applyRideState, reconnectRideSocket } from "../lib/useRide";
import { DestinationPicker } from "./DestinationPicker";

type View =
  | { kind: "loading" }
  | { kind: "result"; res: TapResult }
  | { kind: "failed"; message: string };

export function Tap() {
  const { car = "" } = useParams();
  const [params] = useSearchParams();
  const nonce = params.get("n") ?? undefined;
  const location = useLocation();
  const navigate = useNavigate();

  const [view, setView] = useState<View>({ kind: "loading" });
  const sent = useRef(false);

  const submit = useCallback(
    async (destinationStop?: string) => {
      setView({ kind: "loading" });
      try {
        const res = await api.tap({ car, nonce, destinationStop });
        if (res.result === "checked-in") {
          applyRideState(res.state);
          reconnectRideSocket();
        } else if (res.result === "moved-car") {
          applyRideState(res.state);
        }
        setView({ kind: "result", res });
      } catch (e) {
        setView({ kind: "failed", message: errorMessage(e) });
      }
    },
    [car, nonce],
  );

  useEffect(() => {
    if (sent.current) return;
    if (!hasToken()) {
      navigate(onboardingPath(location.pathname + location.search), { replace: true });
      return;
    }
    sent.current = true;
    if (!CarId.safeParse(car).success) {
      setView({ kind: "failed", message: "This tag has an unknown car number." });
      return;
    }
    void submit();
  }, [car, location.pathname, location.search, navigate, submit]);

  return (
    <main className="screen">
      <TapBody view={view} car={car} onPickDestination={(stop) => void submit(stop)} />
      <Link className="btn" to="/">
        Go to Ride Mode
      </Link>
    </main>
  );
}

function TapBody({
  view,
  car,
  onPickDestination,
}: {
  view: View;
  car: string;
  onPickDestination: (stop: string) => void;
}) {
  if (view.kind === "loading") {
    return (
      <section className="stack">
        <h1>Car {car}</h1>
        <p className="muted">Checking your tap...</p>
      </section>
    );
  }
  if (view.kind === "failed") {
    return (
      <section className="stack">
        <h1>That tap did not go through</h1>
        <p className="error">{view.message}</p>
      </section>
    );
  }

  const res = view.res;
  switch (res.result) {
    case "need-destination":
      return <DestinationPicker line={res.line} stops={res.stops} onPick={onPickDestination} />;
    case "checked-in":
      return (
        <section className="stack">
          <h1>You're in car {res.state.car ?? car}</h1>
          <p className="muted">
            Ride Mode is on. We'll find the closest rider who shares your interests. Keep your
            glasses page open.
          </p>
        </section>
      );
    case "moved-car":
      return (
        <section className="stack">
          <h1>Moved to car {res.state.car ?? car}</h1>
          <p className="muted">Your check-in follows you. Matching picks up from here.</p>
        </section>
      );
    case "stamp-pending":
      return (
        <section className="stack">
          <h1>Tapped!</h1>
          <p className="muted">Waiting for your partner to tap the same kiosk.</p>
        </section>
      );
    case "stamp-awarded":
      return (
        <section className="stack">
          <h1>Stamp collected</h1>
          <StampCard stamp={res.stamp} />
        </section>
      );
    case "error":
      return (
        <section className="stack">
          <h1>That tap did not go through</h1>
          <p className="error">{res.message}</p>
        </section>
      );
  }
}
