import type { CSSProperties } from "react";
import { Button, Screen } from "../../ui";
import { useApp, useRide } from "../../state/store";
import { LINES, stationById } from "../../../shared/catalog";
import { lineProgress } from "../../state/progress";
import { MeetTopBar } from "./parts/MeetTopBar";
import { StampTicketLarge, stampDate, stampLineLabel } from "./parts/StampTicket";
import { Confetti, friendColor, LineProgress } from "./parts/Celebrate";

/** The stamp landing on the ticket once it has been caught: the stamp thunks down, then its ink ring spreads. */
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
      {/* Hidden until the stamp has landed (the ring's first frame would otherwise show during the delay). */}
      <div className="anim-ink" style={{ ...ring, opacity: 0, animationDelay: "1500ms", animationFillMode: "forwards" }} />
      <div
        className="anim-stamp"
        style={{
          ...ring,
          animationDelay: "950ms",
          zIndex: 1,
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

/**
 * G2: both tapped the kiosk tag. The ticket drops in and lands in your hands and your
 * match's, the stamp thunks down, confetti flies, and the kiosk celebrates in the pair color.
 */
export default function Stamp() {
  const { ride, act } = useRide();
  const { state } = useApp();
  const m = ride.match;
  const stamp = ride.stamp;
  const name = m?.firstName ?? stamp?.withFirstName ?? "them";
  const stationId = stamp?.stationId ?? ride.checkIn?.nextStationId ?? "";
  const station = stamp?.stationName ?? stationById(stationId)?.name ?? "Station";
  const line = stamp?.line ?? ride.checkIn?.line ?? "green";
  const branch = stamp?.branch ?? ride.checkIn?.branch;
  const rare = !!stamp?.rare;
  const passport = state.stamps.length + (stamp && !state.stamps.some((s) => s.id === stamp.id) ? 1 : 0);
  /** Rises in `ms` after the screen appears; `cls` are the element's own classes. */
  // This stamp counts towards the line even if the passport hasn't caught up with it yet.
  const counted = state.stamps.some((s) => s.id === stamp?.id) || !stamp ? state.stamps : [...state.stamps, stamp];
  const progress = lineProgress(counted, line, branch);
  const enter = (ms: number, cls: string) => ({ className: `${cls} q-enter`, style: { "--d": ms } as CSSProperties });

  return (
    <Screen label="G2" blobs={false} footer={<Button onClick={act.toRecap}>Continue</Button>}>
      <MeetTopBar partner={m} />

      <div className="g2-stage">
        <div className="g2-rays" aria-hidden />
        <div className="g2-group">
          <img className="g2-platform" src="/art/stage-platform.webp" alt="" />
          <img className="g2-rider g2-rider--you" src="/art/cheer-you.webp" alt="" />
          <img className="g2-rider g2-rider--friend" src={`/art/cheer-friend-${friendColor(m?.color)}.webp`} alt="" />
          <div className="g2-ticket">
            <div className="g2-ticket__float">
              <StampTicketLarge
                station={station}
                lineLabel={stampLineLabel(line, branch, ride.checkIn?.car)}
                line={line}
                date={stampDate(stamp?.earnedAt ?? new Date().toISOString())}
                withName={name}
                rare={rare}
                shine
              />
              <StampMark rare={rare} />
              <Confetti delay={950} />
            </div>
          </div>
        </div>
        <div {...enter(1050, "g2-title")}>
          <h1>
            {rare && "★ Rare "}
            {station} stamp
          </h1>
          <p>
            +1 person met · with {name}
            {stamp?.delayNote && (
              <>
                <br />
                <span style={{ fontSize: 19 }}>{stamp.delayNote}</span>
              </>
            )}
          </p>
        </div>
        <div {...enter(1200, "g2-chips")}>
          <span className="q-pill">
            {passport} {passport === 1 ? "stamp" : "stamps"} in your passport
          </span>
        </div>
        <div {...enter(1300, "")}>
          <LineProgress label={stampLineLabel(line, branch)} got={progress.got} total={progress.total} color={LINES[line].hex} delay={1700} />
        </div>
      </div>
    </Screen>
  );
}
