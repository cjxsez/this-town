import type { CSSProperties } from "react";
import { ArtSlot, Button, ButtonRow, Card, Screen } from "../../ui";
import { useRide } from "../../state/store";
import { useNow } from "../../state/useNow";
import { hhmm, secondsUntil } from "../../state/format";
import { stationById } from "../../../shared/catalog";

const cloud = (pos: CSSProperties): CSSProperties => ({
  position: "absolute",
  zIndex: -1,
  borderRadius: "58% 42% 55% 45%/48% 60% 40% 52%",
  background: "var(--foam)",
  filter: "var(--rag)",
  ...pos,
});

export default function Keep() {
  const { ride, act } = useRide();
  const now = useNow();
  const name = ride.match?.firstName ?? "them";
  const station = stationById(ride.stamp?.stationId ?? ride.checkIn?.stationId ?? "")?.name ?? "the station";
  const left = hhmm(secondsUntil(ride.photo?.keepDeadline, now));

  return (
    <Screen
      label="G4"
      blobs="c"
      footer={
        // The sheet sits at the bottom for one-handed use on the train.
        <Card>
          <h1 className="q-title" style={{ fontSize: 40 }}>
            Keep this one?
          </h1>
          <div
            style={{
              height: "clamp(140px, 26dvh, 200px)",
              border: "var(--ol) solid var(--ink)",
              borderRadius: 4,
              overflow: "hidden",
              background: "#C9D6CF",
            }}
          >
            <ArtSlot
              id="memory-photo"
              placeholder={`photo with ${name} at ${station}`}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <p className="q-hint" style={{ fontSize: 18 }}>
            Shared only if you both keep it. If either deletes, it's gone for both. Auto-deletes in{" "}
            <span className="q-num" role="timer">
              {left}
            </span>
            .
          </p>
          <ButtonRow>
            <Button variant="danger" tilt={-0.7} onClick={() => act.keepVote(false)}>
              Delete
            </Button>
            <Button tilt={0.5} onClick={() => act.keepVote(true)}>
              Keep
            </Button>
          </ButtonRow>
        </Card>
      }
    >
      <div style={{ display: "flex" }}>
        <span className="q-pill q-pill--dark" style={{ fontSize: 12 }}>
          On the train
        </span>
      </div>
      <div aria-hidden style={{ flex: 1, minHeight: 40, position: "relative", margin: "0 calc(-1 * var(--gutter))" }}>
        <div className="anim-drift" style={cloud({ left: 40, top: 30, width: 130, height: 60 })} />
        <div
          className="anim-drift"
          style={cloud({ left: "calc(50% + 39px)", top: 90, width: 110, height: 54, animationDelay: "1500ms" })}
        />
      </div>
    </Screen>
  );
}
