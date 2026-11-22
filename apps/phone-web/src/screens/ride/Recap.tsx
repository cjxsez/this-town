import { useNavigate } from "react-router";
import { Button, Card, PairToken, Screen, TextLink } from "../../ui";
import { useApp } from "../../state/store";
import { capitalize, shortDate, timeOfDay } from "../../state/format";
import { missionText, stationById } from "../../../shared/catalog";
import type { Mission } from "../../../shared/types";
import { StampTicketSmall } from "./parts/StampTicket";

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

  return (
    <Screen label="H1" blobs="a" tabs>
      <div className="q-eyebrow" style={{ color: "inherit" }}>
        {stamped ? "Quest complete" : "Time's up"}
        {station && ` · ${station}`} · {timeOfDay(at)}
      </div>

      {person && (
        <Card style={{ borderRadius: "var(--r2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <PairToken color={person.color} name={person.firstName} size={64} />
            <div style={{ minWidth: 0 }}>
              <h1 style={{ font: "700 30px/1.08 var(--font-hand)" }}>{person.firstName}</h1>
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
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <StampTicketSmall
            station={station}
            sub={`${capitalize(shortDate(stamp?.earnedAt ?? at))} · with ${person?.firstName ?? "them"}`}
            rare={!!stamp?.rare}
          />
        </div>
      ) : (
        <Card style={{ rotate: "-0.4deg" }}>
          <span style={{ font: "700 22px/1.1 var(--font-hand)" }}>No stamp this time: the tag needs both of you to tap it before the stop.</span>
        </Card>
      )}

      <p className="q-hint">Ride Mode is still on{dest ? ` until ${dest}` : ""}. You can be matched again after the next stop.</p>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4 }}>
        <Button tilt={0.8} onClick={finish}>
          Back to riding
        </Button>
        <TextLink onClick={seePassport}>See passport</TextLink>
      </div>
    </Screen>
  );
}
