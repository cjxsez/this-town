import { useState } from "react";
import { PAIR_COLOR_HEX } from "@questline/protocol/colors";
import { interestById } from "../../../shared/catalog";
import type { Meet as MeetInfo } from "../../../shared/types";
import { sim } from "../../api";
import { useRide } from "../../state/store";
import { Body, Button, ButtonRow, Card, Eyebrow, Hint, PairToken, Screen, TextLink } from "../../ui";
import { MeetTopBar } from "./parts/MeetTopBar";

/** "Kiosk 1 car forward, car 1413" / "Stay put" / "In your car". */
export function whereToGo(meet: MeetInfo, name: string): { headline: string; detail: string } {
  if (meet.carDelta === 0 && !meet.youWalk) return { headline: "The kiosk in your car", detail: `${name} is in your car too.` };
  if (!meet.youWalk) return { headline: "Stay put", detail: `${name} is coming to the kiosk in your car.` };
  if (meet.carDelta === 0) return { headline: "You're there", detail: "This car's kiosk is the meeting point." };
  const n = Math.abs(meet.carDelta);
  return {
    headline: `Kiosk ${n} car${n === 1 ? "" : "s"} ${meet.carDelta > 0 ? "forward" : "back"}`,
    detail: `Walk to car ${meet.car}.`,
  };
}

/**
 * E1: matched. No accept step (Ride Mode was the yes), so this goes straight to who and
 * where. The meeting point is always a kiosk, glowing the pair color. Tapping its tag is
 * how you say you're there; "Not now" is always here too.
 */
export default function Meet() {
  const { ride, act } = useRide();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const { match, meet } = ride;
  if (!match || !meet) return null;
  const hex = PAIR_COLOR_HEX[match.color];
  const where = whereToGo(meet, match.firstName);
  const shared = match.shared.map((id) => interestById(id)?.label ?? id);

  return (
    <Screen
      label="E1"
      blobs="b"
      footer={
        confirmSkip ? (
          <Card style={{ gap: 8 }}>
            <Body style={{ margin: 0 }}>
              Skip {match.firstName}? We won't match you two again this ride, and you won't be matched with anyone for 10 minutes.
            </Body>
            <ButtonRow>
              <Button variant="secondary" onClick={() => setConfirmSkip(false)}>
                Keep it
              </Button>
              <Button variant="danger" onClick={act.notNow}>
                Not now
              </Button>
            </ButtonRow>
          </Card>
        ) : (
          <>
            {ride.arrived ? (
              <Hint style={{ textAlign: "center" }}>You're at the kiosk. The mission starts on its screen.</Hint>
            ) : (
              <Button onClick={act.arrived} style={{ minHeight: 60 }}>
                I'm at the kiosk
              </Button>
            )}
            {match.game && (
              <Button variant="secondary" to={`/m?code=${match.game.code}&seat=${match.game.seat}`}>
                Play a game together
              </Button>
            )}
            <TextLink onClick={() => setConfirmSkip(true)}>Not now</TextLink>
          </>
        )
      }
    >
      <MeetTopBar />

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <PairToken color={match.color} name={match.firstName} size={104} style={{ borderWidth: 3, boxShadow: "3px 5px 0 var(--shadow)" }} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ font: "400 30px/1.02 var(--font-display)", textTransform: "uppercase" }}>Meet {match.firstName}</h1>
          <div style={{ fontSize: 21, lineHeight: 1.2, marginTop: 6, textWrap: "pretty" }}>{match.why}</div>
        </div>
      </div>

      <Card style={{ gap: 8, borderRadius: "var(--r1)", borderColor: hex, borderWidth: 4 }}>
        <Eyebrow>Meet at</Eyebrow>
        <div style={{ font: "400 28px/1.02 var(--font-display)", textTransform: "uppercase" }}>{where.headline}</div>
        <Body style={{ margin: 0 }}>{where.detail}</Body>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ width: 28, height: 28, borderRadius: "50%", background: hex, border: "var(--ol) solid var(--ink)" }} />
          <span style={{ font: "700 21px/1.1 var(--font-hand)" }}>The kiosk is glowing {match.color}.</span>
        </div>
        {!ride.arrived && <Hint>Tap its tag when you get there. That's how it knows you're both here.</Hint>}
      </Card>

      {shared.length > 0 && (
        <Card style={{ gap: 6, borderRadius: "var(--r2)" }}>
          <Eyebrow>You both like</Eyebrow>
          <div style={{ font: "700 24px/1.08 var(--font-hand)" }}>{shared.join(", ")}</div>
        </Card>
      )}

      {sim && !ride.arrived && meet.youWalk && (
        <TextLink small to={`/k/${meet.car}`}>
          demo: tap the car {meet.car} kiosk →
        </TextLink>
      )}
    </Screen>
  );
}
