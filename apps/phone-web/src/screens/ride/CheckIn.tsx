import { useState } from "react";
import { useNavigate } from "react-router";
import { DEMO_TRIP } from "../../../shared/catalog";
import { sim } from "../../api";
import { useRide } from "../../state/store";
import { Body, Button, Card, Eyebrow, Hint, Screen, Title } from "../../ui";
import { PlatformBlobs, PlatformQuestsToggle } from "./parts/PlatformKit";

/** A car to "tap" when there's no real tag to hand: mock mode, or VITE_DEMO_CAR in http mode. */
const DEMO_CAR: string | undefined = sim ? DEMO_TRIP.cars[1] : import.meta.env.VITE_DEMO_CAR;

/**
 * C1: Ride Mode off. The only way to turn it on is tapping the kiosk tag in your train car,
 * so this screen just says how. The switch explains rather than toggles.
 */
export default function CheckIn() {
  const { ride } = useRide();
  const navigate = useNavigate();
  const [explain, setExplain] = useState(false);

  return (
    <Screen label="C1" tabs blobs={false}>
      <PlatformBlobs blobs={[[120, 110, 330, 200], [-80, 60, 240, 130]]} />
      <Title>Tap the kiosk in your car.</Title>
      <Body>Every train car has an In This Town kiosk. Hold your phone to the tag on it to turn on Ride Mode.</Body>

      <Card style={{ gap: 10 }}>
        <Eyebrow>How Ride Mode works</Eyebrow>
        <Step n={1}>Tap the tag and pick your stop.</Step>
        <Step n={2}>Turn on Ride Mode. That's your yes to being matched on this train.</Step>
        <Step n={3}>We match you with the closest rider who shares your interests. Your glasses and the kiosk show who and where.</Step>
        <Step n={4}>Meet at the kiosk, play a quick mission, both tap the tag for a stamp.</Step>
        <Hint>Ride Mode turns off at your stop. "Not now" and ghost mode are always one tap away.</Hint>
      </Card>

      <PlatformQuestsToggle on={false} onToggle={() => setExplain(true)} label="Ride Mode" />
      {explain && (
        <Card style={{ background: "var(--sky)" }}>
          <Body>Ride Mode turns on from the kiosk tag, so we know which car you're in. Find the "Tap here" sign on the kiosk.</Body>
        </Card>
      )}

      {DEMO_CAR && (
        <Button variant="secondary" onClick={() => navigate(`/k/${DEMO_CAR}`)}>
          Demo: tap the car {DEMO_CAR} kiosk
        </Button>
      )}
      {ride.checkIn && <Hint>Last ride: car {ride.checkIn.car} to {ride.checkIn.destinationName}.</Hint>}
    </Screen>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span
        aria-hidden
        style={{
          flex: "none",
          width: 26,
          height: 26,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "var(--ink)",
          color: "var(--paper)",
          font: "400 14px var(--font-display)",
        }}
      >
        {n}
      </span>
      <Body style={{ margin: 0 }}>{children}</Body>
    </div>
  );
}
