import { Button, ButtonRow, Card, Screen, TextLink } from "../../ui";
import { useRide } from "../../state/store";
import { stationById } from "../../../shared/catalog";
import { BumpQuestBar } from "./parts/BumpQuestBar";
import { StampTicketLarge, stampDate, stampLineLabel } from "./parts/StampTicket";

/** The stamp landing on the ticket: ink ring first, then the stamp itself. */
function StampMark({ rare }: { rare: boolean }) {
  const ring = {
    position: "absolute",
    right: 22,
    top: -8,
    width: 90,
    height: 90,
    boxSizing: "border-box",
    borderRadius: "50%",
    border: "4px solid var(--brick)",
  } as const;
  return (
    <>
      <div className="anim-ink" style={{ ...ring, animationDelay: "850ms" }} />
      <div
        className="anim-stamp"
        style={{
          ...ring,
          animationDelay: "300ms",
          color: "var(--brick)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          font: "400 15px/1.05 var(--font-display)",
        }}
      >
        <div style={{ position: "absolute", inset: 5, borderRadius: "50%", border: "2px dashed var(--brick)" }} />
        {rare ? (
          <>
            <span>★ RARE</span>
            <span>QUEST</span>
          </>
        ) : (
          <>
            <span>QUEST</span>
            <span>DONE</span>
          </>
        )}
      </div>
    </>
  );
}

export default function Stamp() {
  const { ride, act, profile } = useRide();
  const m = ride.match;
  const name = m?.firstName ?? "them";
  const stamp = ride.stamp;
  const stationId = stamp?.stationId ?? ride.checkIn?.stationId ?? "";
  const station = stationById(stationId)?.name ?? "Station";
  const line = stamp?.line ?? ride.checkIn?.line ?? "green";
  const branch = stamp?.branch ?? ride.checkIn?.branch;
  const rare = !!stamp?.rare;

  // The glasses take the photo, so the question only exists if one of you wears them.
  const canPhoto = profile.hasGlasses || !!m?.hasGlasses;
  const waiting = ride.photo?.you === true && ride.photo.partner === undefined;

  return (
    <Screen
      label="G2"
      blobs="a"
      footer={
        canPhoto ? (
          <Card style={{ borderRadius: "var(--r2)" }}>
            <h2 className="q-title--md">
              Snap a memory together?
            </h2>
            <p className="q-hint" style={{ fontSize: 18 }}>
              Only if you both say yes. Deleted in 24 h unless you both keep it.
            </p>
            {waiting ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <p aria-live="polite" style={{ font: "700 22px var(--font-hand)", minHeight: 44, display: "flex", alignItems: "center" }}>
                  Waiting on {name}…
                </p>
                <TextLink small onClick={() => act.photoVote(false)}>
                  Changed my mind
                </TextLink>
              </div>
            ) : (
              <ButtonRow>
                <Button variant="secondary" onClick={() => act.photoVote(false)}>
                  No thanks
                </Button>
                <Button onClick={() => act.photoVote(true)}>
                  Yes
                </Button>
              </ButtonRow>
            )}
          </Card>
        ) : (
          // No glasses on either side: no photo, straight on to the recap.
          <Button onClick={() => act.photoVote(false)}>Continue</Button>
        )
      }
    >
      <BumpQuestBar />

      <div style={{ position: "relative", height: 216, flex: "none", margin: "0 calc(-1 * var(--gutter))", zIndex: -1 }}>
        <div
          className="anim-spin"
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            marginLeft: -280,
            top: -172,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: "repeating-conic-gradient(var(--foam) 0deg 10deg, transparent 10deg 20deg)",
            maskImage: "radial-gradient(circle, #000 28%, transparent 68%)",
          }}
        />
        <div style={{ position: "absolute", left: 0, right: 0, top: 22, display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: "min(350px, calc(100% - 28px))" }}>
            <div className="anim-ticketIn">
              <StampTicketLarge
                station={station}
                lineLabel={stampLineLabel(line, branch, ride.checkIn?.direction)}
                line={line}
                date={stampDate(stamp?.earnedAt ?? new Date().toISOString())}
                withName={name}
                rare={rare}
                number={profile.badge?.number}
              />
            </div>
            <StampMark rare={rare} />
          </div>
        </div>
      </div>

      <h1 style={{ font: "400 30px/1.02 var(--font-display)", textAlign: "center", textTransform: "uppercase" }}>
        {rare && "★ Rare "}
        {station} stamp
      </h1>
      <p style={{ fontSize: 22, lineHeight: 1.2, textWrap: "pretty", textAlign: "center" }}>
        +1 person met · with {name}
        {stamp?.delayNote && (
          <>
            <br />
            <span style={{ fontSize: 19 }}>{stamp.delayNote}</span>
          </>
        )}
      </p>
    </Screen>
  );
}
