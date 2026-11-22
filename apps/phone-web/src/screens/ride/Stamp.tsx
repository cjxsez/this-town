import { Button, Screen } from "../../ui";
import { useRide } from "../../state/store";
import { stationById } from "../../../shared/catalog";
import { MeetTopBar } from "./parts/MeetTopBar";
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

/** G2: both tapped the kiosk tag. The stamp lands; the kiosk celebrates in the pair color. */
export default function Stamp() {
  const { ride, act } = useRide();
  const m = ride.match;
  const stamp = ride.stamp;
  const name = m?.firstName ?? stamp?.withFirstName ?? "them";
  const stationId = stamp?.stationId ?? ride.checkIn?.nextStationId ?? "";
  const station = stamp?.stationName ?? stationById(stationId)?.name ?? "Station";
  const line = stamp?.line ?? ride.checkIn?.line ?? "green";
  const branch = stamp?.branch ?? ride.checkIn?.branch;
  const rare = !!stamp?.rare;

  return (
    <Screen label="G2" blobs="a" footer={<Button onClick={act.toRecap}>Continue</Button>}>
      <MeetTopBar partner={m} />

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
                lineLabel={stampLineLabel(line, branch, ride.checkIn?.car)}
                line={line}
                date={stampDate(stamp?.earnedAt ?? new Date().toISOString())}
                withName={name}
                rare={rare}
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
