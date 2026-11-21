import { useNavigate } from "react-router";
import { AnimalToken, Button, Card, Screen, TextLink, Toggle } from "../../ui";
import { useApp } from "../../state/store";
import { capitalize, pron, shortDate, timeOfDay } from "../../state/format";
import { badgeName, missionText, stationById } from "../../../shared/catalog";
import type { Mission } from "../../../shared/types";
import { StampTicketSmall } from "./parts/StampTicket";

/** "Rename Kenmore together." → "Rename Kenmore": the short label the recap quotes. */
function recapMissionLabel(m: Mission, station: string, name: string) {
  return missionText(m.title, { station, name })
    .replace(/\s+together\.?$/i, "")
    .replace(/[.!?]$/, "");
}

export default function Recap() {
  const { state, actions } = useApp();
  const navigate = useNavigate();
  const { ride } = state;
  const recap = state.lastRecap;
  const person = recap?.person ?? ride.match;
  const stationId = recap?.stationId ?? ride.checkIn?.stationId ?? "";
  const station = stationById(stationId)?.name ?? "";
  const at = recap?.at ?? new Date().toISOString();
  const mission = recap?.mission ?? ride.mission?.mission;
  const note = recap?.note ?? ride.note;
  const stamp = state.stamps.find((s) => s.id === recap?.stampId) ?? ride.stamp;
  const saved = person && state.people.find((p) => p.id === person.id);
  const staying = !!saved && saved.stayInTouch !== "off";

  const finish = () => actions.ride.finish();
  const seePassport = () => {
    finish();
    navigate("/passport");
  };

  const p = person && pron(person.pronoun);
  const turns = person?.pronoun === "they" ? "turn" : "turns";

  return (
    <Screen label="H1" blobs="a" tabs>
      <div className="q-eyebrow" style={{ color: "inherit" }}>
        Quest complete{station && ` · ${station}`} · {timeOfDay(at)}
      </div>

      {person && (
        <Card style={{ borderRadius: "var(--r2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <AnimalToken badge={person.badge} size={64} />
            <div style={{ minWidth: 0 }}>
              <h1 style={{ font: "700 30px/1.08 var(--font-hand)" }}>
                {person.firstName} · {badgeName(person.badge)}
              </h1>
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

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <StampTicketSmall
          station={station}
          sub={`${capitalize(shortDate(stamp?.earnedAt ?? at))} · with ${person?.firstName ?? "them"}`}
          rare={!!stamp?.rare}
        />
        {recap?.photo === "waiting" && person && (
          <div
            style={{
              flex: 1,
              minHeight: 70,
              border: "2px dashed var(--ink)",
              borderRadius: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 6,
              font: "700 18px/1.1 var(--font-hand)",
            }}
          >
            photo · waiting on {person.firstName}
          </div>
        )}
        {recap?.photo === "kept" && (
          <div style={{ flex: 1, textAlign: "center", font: "700 18px/1.1 var(--font-hand)" }}>photo · kept</div>
        )}
      </div>

      {person && p && (
        <Card style={{ rotate: "-0.4deg" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ font: "700 24px/1.08 var(--font-hand)" }}>
              Stay in touch with {person.firstName}
            </span>
            <Toggle
              checked={staying}
              onChange={(on) => void actions.setStayInTouch(person.id, on)}
              label={`Stay in touch with ${person.firstName}`}
            />
          </div>
          <p className="q-hint">
            {capitalize(p.will)} see your handle only if {p.subj} {turns} this on too. {p.Subj} won't know if you don't.
          </p>
        </Card>
      )}

      {recap && recap.streak > 1 && (
        <div style={{ display: "flex" }}>
          <span className="q-pill" style={{ background: "var(--yellow)", borderRadius: "var(--r4)" }}>
            Streak · {recap.streak} rides in a row with a quest
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4 }}>
        <Button tilt={0.8} onClick={seePassport}>
          See passport
        </Button>
        <TextLink onClick={finish}>Done</TextLink>
      </div>
    </Screen>
  );
}
