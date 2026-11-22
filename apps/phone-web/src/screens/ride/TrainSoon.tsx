import { useEffect, useRef } from "react";
import { Button, Screen } from "../../ui";
import { useRide } from "../../state/store";
import { useNow } from "../../state/useNow";
import { clock, secondsUntil } from "../../state/format";
import { meetLineLabel, meetStationName } from "./parts/MeetTopBar";
import { PlatformScene3D } from "./parts/PlatformScene3D";
import { QuestTrainScene } from "./parts/QuestTrainScene";

// F3: train in 30 s. RideRoute lays this over whatever phase is showing; it
// replaces the screen visually. Before the met state there's no stamp to
// promise, so the copy stays neutral and the only way out is boarding.
export default function TrainSoon() {
  const { ride, act } = useRide();
  const now = useNow();
  const met = ride.phase !== "meet" && ride.phase !== "cantSpot";
  const station = meetStationName(ride.checkIn);
  const t = clock(secondsUntil(ride.trainAt, now));
  const ref = useRef<HTMLDivElement>(null);
  // Move focus into the takeover so screen readers and keyboards land on it, not the screen underneath.
  useEffect(() => ref.current?.focus(), []);

  const bumpFirst = () => {
    if (ride.phase === "mission" || ride.phase === "greeting") act.missionDone();
    act.dismissTrainSoon();
  };
  const boardUnmet = () => {
    act.withdraw();
    act.dismissTrainSoon();
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="train-soon-title"
      aria-describedby="train-soon-copy"
      style={{ position: "absolute", inset: 0, zIndex: 50, outline: "none" }}
    >
      <Screen label="F3" blobs={false} background="var(--yellow)" bodyStyle={{ paddingBottom: 0, gap: 14, color: "var(--ink)" }}>
        <div style={{ font: "400 11px/1.3 var(--font-display)", letterSpacing: ".06em", textAlign: "center", marginTop: 8, textTransform: "uppercase" }}>
          {station} · {meetLineLabel(ride.checkIn)}
        </div>
        <h1 id="train-soon-title" style={{ textAlign: "center" }}>
          <span style={{ display: "block", font: "400 40px/1.02 var(--font-display)" }}>TRAIN IN</span>
          <span
            role="timer"
            className="q-num"
            style={{ display: "block", font: "400 clamp(84px, 28vw, 112px)/.95 var(--font-shade)", marginTop: 14 }}
          >
            {t}
          </span>
        </h1>
        <p id="train-soon-copy" style={{ font: "700 25px/1.08 var(--font-hand)", textAlign: "center", textWrap: "balance" }}>
          {met ? `Wrap it up. Your ${station} stamp is saved.` : "Train's here. Catch it — no hard feelings."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {met ? (
            <>
              <Button variant="dark" onClick={bumpFirst}>
                Quick bump first
              </Button>
              <Button variant="secondary" onClick={act.board}>
                I'm boarding
              </Button>
            </>
          ) : (
            <Button variant="dark" onClick={boardUnmet}>
              I'm boarding
            </Button>
          )}
        </div>
        {/* The trolley rolls in as the countdown runs out. */}
        <div style={{ flex: 1, minHeight: 260, position: "relative", margin: "0 calc(-1 * var(--gutter))", borderTop: "2.5px solid var(--ink)" }}>
          <PlatformScene3D
            line={ride.checkIn?.line}
            mode="arrive"
            arriveAt={ride.trainAt}
            fallback={<QuestTrainScene line={ride.checkIn?.line} />}
            style={{ position: "absolute", inset: 0 }}
          />
        </div>
      </Screen>
    </div>
  );
}
