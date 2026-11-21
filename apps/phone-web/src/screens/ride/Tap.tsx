import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { backend } from "../../api";
import { errorMessage, type TapResult } from "../../lib/api";
import { useApp } from "../../state/store";
import { Body, Button, Card, Eyebrow, Hint, Screen, Title } from "../../ui";

const PENDING_KEY = "questline.pendingTap";

/** The tap a rider made before they had a profile, read once. */
export function takePendingTap(): string | null {
  try {
    const path = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return path?.startsWith("/k/") ? path : null;
  } catch {
    return null;
  }
}

// One request per tag read: the nonce is single-use, and StrictMode runs effects twice in dev.
const inFlight = new Map<string, Promise<TapResult>>();

type View =
  | { step: "working" }
  | { step: "destination"; stops: string[] }
  | { step: "error"; message: string }
  | { step: "done" };

/**
 * /k/:car?n=<nonce>: where the kiosk's NFC tag sends the phone. The worker decides what the
 * tap means (check in, move car, or stamp), so this screen only asks for a destination when
 * the worker wants one and then hands over to /ride.
 */
export default function Tap() {
  const { car = "" } = useParams();
  const [query] = useSearchParams();
  const nonce = query.get("n") ?? undefined;
  const { state, actions } = useApp();
  const profile = state.profile;
  const [view, setView] = useState<View>({ step: "working" });

  const send = useCallback(
    (destinationStop?: string) => {
      if (!backend || !profile) return;
      setView({ step: "working" });
      const key = `${car}|${nonce ?? ""}|${destinationStop ?? ""}`;
      let req = inFlight.get(key);
      if (!req) {
        req = backend.ride.tap({ car, nonce, destinationStop }, profile).finally(() => inFlight.delete(key));
        inFlight.set(key, req);
      }
      req.then(
        (res) => {
          if (res.result === "need-destination") return setView({ step: "destination", stops: res.stops });
          if (res.result === "error") return setView({ step: "error", message: res.message });
          if (res.result === "stamp-pending") {
            // Our half of the stamp is in: show the "waiting on them" side of the bump screen.
            actions.ride.missionDone();
            actions.ride.bump();
          }
          setView({ step: "done" });
        },
        (e) => setView({ step: "error", message: errorMessage(e) }),
      );
    },
    [car, nonce, profile, actions],
  );

  useEffect(() => send(), [send]);

  if (!profile) {
    try {
      sessionStorage.setItem(PENDING_KEY, `/k/${car}${nonce ? `?n=${encodeURIComponent(nonce)}` : ""}`);
    } catch {
      // Storage blocked: they tap again after joining.
    }
    return <Navigate to="/" replace />;
  }
  // The simulator has no kiosks.
  if (!backend || view.step === "done") return <Navigate to="/ride" replace />;

  return (
    <Screen label="Kiosk tap" blobs="b">
      <Eyebrow>Car {car}</Eyebrow>
      {view.step === "working" && (
        <div role="status">
          <Title style={{ fontSize: 44 }}>One sec…</Title>
        </div>
      )}
      {view.step === "destination" && (
        <>
          <Title style={{ fontSize: 40 }}>Where are you getting off?</Title>
          <Hint>Quests stop before your stop, so you never miss it.</Hint>
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {view.stops.map((stop) => (
                <Button key={stop} variant="secondary" onClick={() => send(stop)}>
                  {stop}
                </Button>
              ))}
            </div>
          </Card>
        </>
      )}
      {view.step === "error" && (
        <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Title style={{ fontSize: 44 }}>That tap didn't take.</Title>
          <Body>{view.message}</Body>
          <Hint>Tap the tag again to get a fresh one.</Hint>
          <Button to="/ride">Back to Ride Mode</Button>
        </div>
      )}
    </Screen>
  );
}
