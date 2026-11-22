import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { PAIR_COLOR_HEX } from "@questline/protocol/colors";
import { backend } from "../../api";
import { errorMessage, type TapResult } from "../../lib/api";
import { playTapSound } from "../../lib/sound";
import { useApp } from "../../state/store";
import { Body, Button, Card, Eyebrow, Hint, Screen, TextLink, Title } from "../../ui";

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

/** The car of a tap waiting on sign-in, without using it up (for "then we'll check you in"). */
export function peekPendingCar(): string | null {
  try {
    const path = sessionStorage.getItem(PENDING_KEY);
    return path?.startsWith("/k/") ? decodeURIComponent(path.slice(3).split(/[?/]/)[0] ?? "") || null : null;
  } catch {
    return null;
  }
}

// One request per tag read: the nonce is single-use, and StrictMode runs effects twice in dev.
const inFlight = new Map<string, Promise<TapResult>>();

type Stop = { id: string; name: string };
type View =
  | { step: "working" }
  | { step: "destination"; stops: Stop[]; picked: string | null }
  | { step: "confirm"; stops: Stop[]; dest: Stop }
  | { step: "on"; car: string; dest: string; next: string | null }
  | { step: "moved"; car: string; meeting: boolean }
  | { step: "already"; car: string }
  | { step: "stampPending" }
  | { step: "stamped"; station: string; partner: string }
  | { step: "error"; message: string };

/**
 * /k/:car?n=<nonce>: where the kiosk's NFC tag sends the phone. The server decides what the
 * tap means. On the first tap of a ride that is: pick your stop, then confirm Ride Mode.
 * Confirming is the consent to be matched on this train, so it's its own screen that says
 * exactly what it means, and only "Turn on Ride Mode" sends rideMode: true.
 *
 * Not signed in: the tap is parked, the rider signs in with an email code (/signin) or
 * onboards, and App's usePendingTap brings them back here.
 */
export default function Tap() {
  const { car = "" } = useParams();
  const [query] = useSearchParams();
  const nonce = query.get("n") ?? undefined;
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const profile = state.profile;
  const [view, setView] = useState<View>({ step: "working" });
  const partner = useRef(state.ride.match?.firstName);
  partner.current = state.ride.match?.firstName ?? partner.current;

  // Chime as soon as the tag link opens, signed in or not.
  useEffect(() => playTapSound(), []);

  const send = useCallback(
    (destinationStop?: string, rideMode?: true) => {
      if (!profile) return;
      setView({ step: "working" });
      const key = `${car}|${nonce ?? ""}|${destinationStop ?? ""}|${rideMode ? 1 : 0}`;
      let req = inFlight.get(key);
      if (!req) {
        req = actions.ride.tapKiosk({ car, nonce, destinationStop, rideMode }).finally(() => inFlight.delete(key));
        inFlight.set(key, req);
      }
      req.then(
        (res) => {
          switch (res.result) {
            case "need-destination":
              return setView({ step: "destination", stops: res.stops, picked: res.suggestedStop });
            case "checked-in":
              return setView(
                rideMode
                  ? { step: "on", car: res.state.car ?? car, dest: res.state.destinationStop ?? "", next: res.state.nextStop }
                  : { step: "already", car: res.state.car ?? car },
              );
            case "moved-car":
              return setView({ step: "moved", car: res.state.car ?? car, meeting: res.state.status === "matched" || res.state.status === "in-mission" });
            case "stamp-pending":
              return setView({ step: "stampPending" });
            case "stamp-awarded":
              return setView({ step: "stamped", station: res.stamp.station, partner: res.stamp.partnerFirstName });
            case "error":
              return setView({ step: "error", message: res.message });
          }
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
    // Not signed in: sign in with an email code (or onboard), then usePendingTap replays this.
    return <Navigate to={backend ? "/signin" : "/"} replace />;
  }

  const toRide = () => navigate("/ride", { replace: true });
  const color = state.ride.match ? PAIR_COLOR_HEX[state.ride.match.color] : undefined;

  const footer =
    view.step === "destination" ? (
      <Button
        disabled={!view.picked}
        onClick={() => {
          const dest = view.stops.find((s) => s.id === view.picked);
          if (dest) setView({ step: "confirm", stops: view.stops, dest });
        }}
      >
        Next
      </Button>
    ) : view.step === "confirm" ? (
      <>
        <Button huge onClick={() => send(view.dest.id, true)}>
          Turn on Ride Mode
        </Button>
        <TextLink to="/ride">Not today</TextLink>
      </>
    ) : undefined;

  return (
    <Screen label="Kiosk tap" blobs="b" footer={footer}>
      <Eyebrow>Car {car}</Eyebrow>

      {view.step === "working" && (
        <div role="status">
          <Title>One sec…</Title>
        </div>
      )}

      {view.step === "destination" && (
        <>
          <Title>Where are you getting off?</Title>
          <Hint>Ride Mode turns off at your stop, and missions always end before a stop, so you never miss it.</Hint>
          <Card>
            <div role="radiogroup" aria-label="Your stop" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {view.stops.map((stop) => (
                <Button
                  key={stop.id}
                  variant={view.picked === stop.id ? "leaf" : "secondary"}
                  role="radio"
                  aria-checked={view.picked === stop.id}
                  onClick={() => setView({ ...view, picked: stop.id })}
                >
                  {stop.name}
                </Button>
              ))}
            </div>
          </Card>
        </>
      )}

      {view.step === "confirm" && (
        <>
          <Title>Turn on Ride Mode?</Title>
          <Body>
            Car {car}, riding to <strong>{view.dest.name}</strong>.
          </Body>
          <Card style={{ gap: 10 }}>
            <Eyebrow>While Ride Mode is on</Eyebrow>
            <Rule>We'll match you with the closest rider on this train who shares your interests. There's no accept step: turning this on is your yes.</Rule>
            <Rule>Your glasses and the kiosk show who and where. Your match sees your first name and your pair color. The kiosk screen only shows first names.</Rule>
            <Rule>You meet at a kiosk, play a short mission, and both tap the tag for a stamp. Missions end before your stop.</Rule>
            <Rule>Not into it? Tap "Not now" any time, or turn on ghost mode. You can report or block anyone you're matched with.</Rule>
            <Rule>Ride Mode turns off by itself at {view.dest.name}.</Rule>
          </Card>
          {state.settings.ghost && <Hint>Ghost mode is on, so nobody will be matched with you until you turn it off.</Hint>}
          <TextLink onClick={() => setView({ step: "destination", stops: view.stops, picked: view.dest.id })}>Change my stop</TextLink>
        </>
      )}

      {view.step === "on" && (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Title>Ride Mode is on.</Title>
          <Card style={{ gap: 6, background: "var(--leaf)" }}>
            <Body style={{ margin: 0 }}>
              Car <strong>{view.car}</strong>, riding to <strong>{view.dest}</strong>.
            </Body>
            {view.next && <Hint>Next stop: {view.next}.</Hint>}
          </Card>
          <Body>
            {profile.glassesLinked
              ? "Put your phone away. Your glasses will show your match and where to go."
              : "Keep this page handy. It'll show your match and where to go."}
          </Body>
          <Button huge onClick={toRide}>
            Got it
          </Button>
        </div>
      )}

      {view.step === "moved" && (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Title>{view.meeting ? "You made it." : `You're in car ${view.car} now.`}</Title>
          <Body>{view.meeting ? "This is your meeting kiosk. The mission starts on its screen in a moment." : "Ride Mode moved with you. Matching uses this car now."}</Body>
          <Button huge onClick={toRide}>
            OK
          </Button>
        </div>
      )}

      {view.step === "already" && (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Title>Ride Mode is already on.</Title>
          <Body>You're checked in to car {view.car}. If you're meeting someone here, the mission starts on the kiosk.</Body>
          <Button huge onClick={toRide}>
            OK
          </Button>
        </div>
      )}

      {view.step === "stampPending" && (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Title>1 of 2 tapped.</Title>
          <Body>Your half is in. Waiting for {partner.current ?? "your match"} to tap the tag.</Body>
          <div aria-hidden style={{ height: 14, borderRadius: 7, border: "var(--ol) solid var(--ink)", overflow: "hidden" }}>
            <div style={{ width: "50%", height: "100%", background: color ?? "var(--leaf)" }} />
          </div>
          <Button huge onClick={toRide}>
            OK
          </Button>
        </div>
      )}

      {view.step === "stamped" && (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Title>Stamped!</Title>
          <Body>
            {view.station} stamp with {view.partner}. It's in your passport.
          </Body>
          <Button huge onClick={toRide}>
            See it
          </Button>
        </div>
      )}

      {view.step === "error" && (
        <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Title>That tap didn't take.</Title>
          <Body>{view.message}</Body>
          <Hint>Tap the tag again to get a fresh one.</Hint>
          <Button onClick={toRide}>Back to Ride Mode</Button>
        </div>
      )}
    </Screen>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span aria-hidden style={{ flex: "none", width: 10, height: 10, marginTop: 8, borderRadius: "50%", background: "var(--ink)" }} />
      <Body style={{ margin: 0 }}>{children}</Body>
    </div>
  );
}
