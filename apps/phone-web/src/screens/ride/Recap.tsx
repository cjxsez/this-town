import type { CSSProperties } from "react";
import { useNavigate } from "react-router";
import { Button, Card, PairToken, Screen, TextLink } from "../../ui";
import { useApp } from "../../state/store";
import { capitalize, shortDate, timeOfDay } from "../../state/format";
import { missionText, stationById } from "../../../shared/catalog";
import type { Mission } from "../../../shared/types";
import { recapEyebrow, recapNoStamp, recapStillRiding } from "../../lib/rideModeCopy";
import { useGamesOnly } from "../../lib/useWorkerMode";
import { StampTicketSmall } from "./parts/StampTicket";
import { friendColor } from "./parts/Celebrate";

/** "Rename Kenmore together." → "Rename Kenmore": the short label the recap quotes. */
function recapMissionLabel(m: Mission, station: string, name: string) {
  return missionText(m.title, { station, name })
    .replace(/\s+together\.?$/i, "")
    .replace(/[.!?]$/, "");
}

/**
 * H1: the quest is over. Who you met, what you played, the stamp. You're still on the
 * train with Ride Mode on, so "Back to riding" returns to the pool.
 */
export default function Recap() {
  const { state, actions } = useApp();
  const navigate = useNavigate();
  const gamesOnly = useGamesOnly();
  const { ride } = state;
  const recap = state.lastRecap;
  const person = recap?.person ?? ride.match;
  const stationId = recap?.stationId ?? ride.checkIn?.nextStationId ?? "";
  const station = stationById(stationId)?.name ?? ride.checkIn?.nextStationName ?? "";
  const at = recap?.at ?? new Date().toISOString();
  const mission = recap?.mission ?? ride.mission?.mission;
  const note = recap?.note ?? ride.note;
  const stamp = state.stamps.find((s) => s.id === recap?.stampId) ?? ride.stamp;
  const stamped = recap?.stamped ?? !!stamp;
  const dest = ride.checkIn?.destinationName;

  const finish = () => actions.ride.finish();
  const seePassport = () => {
    finish();
    navigate("/passport");
  };

  const passport = state.stamps.length;
  /** Rises in `ms` after the screen appears, keeping the element's own class and style. */
  const enter = (ms: number, cls = "", style: CSSProperties = {}) => ({
    className: `${cls} q-enter`.trim(),
    style: { ...style, "--d": ms } as CSSProperties,
  });

  return (
    <Screen label="H1" blobs="a" tabs>
      <div {...enter(0, "q-eyebrow", { color: "inherit" })}>
        {recapEyebrow(stamped, gamesOnly)}
        {station && ` · ${station}`} · {timeOfDay(at)}
      </div>

      {/* You and your match meet in the middle for a high five, the trolley behind you. */}
      <div className="h1-hero" aria-hidden>
        <img className="h1-hero__backdrop" src="/art/recap-backdrop.webp" alt="" />
        <img className="h1-hero__rider h1-hero__rider--you" src="/art/highfive-you.webp" alt="" />
        <img className="h1-hero__rider h1-hero__rider--friend" src={`/art/highfive-friend-${friendColor(person?.color)}.webp`} alt="" />
        <div className="h1-hero__clap">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <span key={deg} style={{ rotate: `${deg}deg` }} />
          ))}
        </div>
      </div>

      {person && (
        <Card {...enter(450, "", { borderRadius: "var(--r2)" })}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <PairToken color={person.color} name={person.firstName} size={64} />
            <div style={{ minWidth: 0 }}>
              <h1 className="q-title--md">{person.firstName}</h1>
              {mission && (
                <p className="q-body" style={{ fontSize: 18, marginTop: 4 }}>
                  "{recapMissionLabel(mission, station, person.firstName)}"
                  {note && (
                    <>
                      {" "}
                      · you called it <b>{note}</b>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {stamped ? (
        <div {...enter(560, "h1-stats")}>
          <StampTicketSmall
            station={station}
            sub={`${capitalize(shortDate(stamp?.earnedAt ?? at))} · with ${person?.firstName ?? "them"}`}
            rare={!!stamp?.rare}
          />
          <div className="h1-stats__list">
            <span className="q-pill">+1 person met</span>
            <span className="q-pill">
              {passport} {passport === 1 ? "stamp" : "stamps"} in passport
            </span>
          </div>
        </div>
      ) : (
        <Card {...enter(560)}>
          <span style={{ font: "700 22px/1.1 var(--font-hand)" }}>{recapNoStamp(gamesOnly)}</span>
        </Card>
      )}

      <p {...enter(640, "q-hint")}>{recapStillRiding(dest, gamesOnly)}</p>

      <div {...enter(720, "", { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4 })}>
        <Button onClick={finish}>Back to riding</Button>
        <TextLink onClick={seePassport}>See passport</TextLink>
      </div>
    </Screen>
  );
}
