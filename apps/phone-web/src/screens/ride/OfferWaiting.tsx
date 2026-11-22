import { sim } from "../../api";
import { useRide } from "../../state/store";
import { AnimalToken, Body, Button, Screen, TextLink, Title, TrainPill } from "../../ui";
import { PlatformStage, PlatformTopBar, useCountdown } from "./parts/PlatformKit";

/** D2: you said yes; the other rider is still deciding. "Waiting" never turns into "declined". */
export default function OfferWaiting() {
  const { ride, act, profile } = useRide();
  const closes = useCountdown(ride.offer?.expiresAt);

  return (
    <Screen
      label="D2"
      blobs="a"
      footer={
        <>
          {sim && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <TextLink small onClick={() => sim?.demo.partnerYes()}>
                demo: they said yes →
              </TextLink>
              <TextLink small onClick={() => sim?.demo.fallThrough()}>
                demo: it fell through →
              </TextLink>
            </div>
          )}
          <Button variant="secondary" onClick={act.withdraw}>
            Never mind
          </Button>
        </>
      }
    >
      <PlatformTopBar ride={ride} />

      <PlatformStage minHeight={130}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            translate: "0 -50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          {profile.badge ? (
            <AnimalToken badge={profile.badge} size={92} style={{ fontSize: 18 }} />
          ) : (
            <div style={{ width: 92, height: 92, borderRadius: "50%", background: "var(--orange)", border: "var(--ol) solid var(--ink)" }} />
          )}
          {[0, 180, 360].map((d) => (
            <span key={d} className="anim-hop" style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--ink)", animationDelay: `${d}ms` }} />
          ))}
          <div
            style={{
              flex: "none",
              width: 92,
              height: 92,
              borderRadius: "50%",
              border: "3px dashed var(--ink)",
              background: "var(--foam)",
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "400 44px var(--font-display)",
            }}
          >
            ?
          </div>
        </div>
      </PlatformStage>

      <div role="status" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Title>You're in.</Title>
        <Body style={{ fontSize: 22 }}>Waiting for the other rider to decide.</Body>
      </div>
      <div style={{ display: "flex" }}>
        <TrainPill>
          <span style={{ fontSize: 12 }}>CLOSES IN {closes}</span>
        </TrainPill>
      </div>
    </Screen>
  );
}
