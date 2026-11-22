import { useEffect } from "react";
import { useRide } from "../../state/store";
import { Button, ButtonRow, Card, Eyebrow, Hint, Screen, TrainPill } from "../../ui";
import {
  PlatformBlobs,
  PlatformPuff,
  PlatformStage,
  PlatformTear,
  PlatformTopBar,
  PlatformTree,
  lineName,
  useCountdown,
  useTrainClock,
} from "./parts/PlatformKit";

/** A distinct buzz, so an offer isn't mistaken for a text. */
const OFFER_BUZZ = [80, 60, 80, 60, 200];

/** D1 (and D4 when offer.rare): the private offer. Skip and Yes are always the same size. */
export default function Offer() {
  const { ride, act } = useRide();
  const offer = ride.offer;
  const rare = !!offer?.rare;
  const closes = useCountdown(offer?.expiresAt);

  useEffect(() => {
    if (offer?.id && typeof navigator !== "undefined") navigator.vibrate?.(OFFER_BUZZ);
  }, [offer?.id]);

  return (
    <Screen label={rare ? "D4" : "D1"} blobs={false}>
      <PlatformBlobs
        blobs={
          rare
            ? [[-40, 130, 340, 190], [230, 60, 230, 130]]
            : [[120, 110, 330, 200], [-80, 60, 240, 130]]
        }
      />
      {rare ? <OfferRareTopBar /> : <PlatformTopBar ride={ride} />}

      <PlatformStage minHeight={190}>
        <PlatformPuff style={{ left: 20, top: 10, width: 110, height: 56 }} />
        <PlatformPuff style={{ left: 270, top: 50, width: 100, height: 50 }} delay={2200} />
        <div
          style={{
            position: "absolute",
            left: 81,
            bottom: 10,
            width: 240,
            height: 40,
            background: "var(--stone)",
            border: "var(--ol) solid var(--ink)",
            borderRadius: 6,
            boxShadow: "3px 6px 0 var(--shadow)",
            filter: "var(--wob)",
          }}
        />
        <div style={{ position: "absolute", left: 161, bottom: 26, width: 80, height: 12, borderRadius: "50%", background: "var(--stone-dk)" }} />
        {/* the other rider stays a mystery until you both say yes */}
        <div
          className="anim-float"
          style={{
            position: "absolute",
            left: 146,
            bottom: 60,
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: rare ? "var(--yellow)" : "var(--foam)",
            border: "3px dashed var(--ink)",
            color: "var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "400 56px var(--font-display)",
          }}
        >
          {rare ? "★" : "?"}
        </div>
        <PlatformTree size={30} style={{ left: 94, bottom: 46 }} />
        <PlatformTree size={36} style={{ left: 286, bottom: 46 }} />
      </PlatformStage>

      <section aria-label="Private offer" className="anim-ticketIn" style={{ flex: "none" }}>
        <Card style={{ overflow: "hidden", background: rare ? "var(--yellow)" : undefined }}>
          <Eyebrow style={rare ? { color: "var(--ink)" } : undefined}>
            {rare ? "Private offer · rare quest ★" : "Private offer · only you see this"}
          </Eyebrow>
          <h1 style={{ font: `700 ${rare ? 31 : 38}px/1.03 var(--font-hand)`, textWrap: "balance" }}>{offer?.why}</h1>
          {rare ? (
            <p style={{ fontSize: 21, lineHeight: 1.2, textWrap: "pretty" }}>Rare {offer?.minutes}-minute quest. Only during delays.</p>
          ) : (
            <>
              <div style={{ font: "700 26px/1.08 var(--font-hand)" }}>{offer?.minutes}-minute quest?</div>
              <Hint>You'll see their name and where to meet only if you both say yes.</Hint>
            </>
          )}
          <PlatformTear />
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <Eyebrow style={rare ? { color: "var(--ink)" } : undefined}>Offer closes in</Eyebrow>
            <div className="q-num" role="timer" style={{ font: "400 22px/1 var(--font-display)" }}>
              {closes}
            </div>
          </div>
          <ButtonRow>
            <Button variant="secondary" onClick={act.skip}>
              Skip
            </Button>
            <Button variant={rare ? "dark" : "primary"} onClick={act.yes}>
              Yes
            </Button>
          </ButtonRow>
        </Card>
      </section>
    </Screen>
  );
}

/** D4's top row: the delay is the headline, the train time is an estimate. */
function OfferRareTopBar() {
  const { ride } = useRide();
  const t = useTrainClock(ride);
  return (
    <div className="q-topbar">
      <span className="q-pill">
        <span className="q-pill__dot" style={{ background: "var(--rust)" }} />
        {lineName(ride.checkIn).toUpperCase()} · DELAYED
      </span>
      <TrainPill>TRAIN ~{t}</TrainPill>
    </div>
  );
}
