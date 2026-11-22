import { Button, Card, Eyebrow, Screen } from "../../ui";
import { useRide } from "../../state/store";
import { useNow } from "../../state/useNow";
import { secondsUntil } from "../../state/format";
import { MISSION_GROUP_LABEL, missionText } from "../../../shared/catalog";
import { MeetTopBar, meetStationName } from "./parts/MeetTopBar";
import { MissionRing } from "./parts/MissionRing";
import "./parts/MissionScreen.css";

/** The F1 header art for "Rename {station}": the sign crossed out, and a blank to fill in (an optional note). */
function MissionRenameArt({ station, note, onNote }: { station: string; note: string; onNote: (v: string) => void }) {
  return (
    <div className="mission-art">
      <div
        className="mission-art__sign"
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          marginLeft: -145,
          top: 6,
          width: 290,
          height: 74,
          background: "var(--paper)",
          color: "var(--ink)",
          border: "var(--ol) solid var(--ink)",
          borderRadius: 5,
          boxShadow: "3px 5px 0 var(--shadow)",
          filter: "var(--wob)",
          overflow: "hidden",
        }}
      >
        <div style={{ height: 12, background: "var(--green)", borderBottom: "var(--ol) solid var(--ink)" }} />
        <div
          style={{
            textAlign: "center",
            font: `400 ${station.length > 10 ? 22 : 32}px/56px var(--font-display)`,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {station}
        </div>
        <div
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            top: 38,
            height: 7,
            background: "var(--rust)",
            border: "2px solid var(--ink)",
            borderRadius: 4,
            transform: "rotate(-4deg)",
          }}
        />
      </div>
      <div
        className={`mission-art__note${note ? "" : " anim-bob"}`}
        style={{ position: "absolute", left: "50%", marginLeft: -118, top: 92, width: 236 }}
      >
        <label
          className="mission-note-box"
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "0 10px",
            background: "var(--yellow)",
            color: "var(--ink)",
            border: "var(--ol) solid var(--ink)",
            borderRadius: 5,
            boxShadow: "3px 5px 0 var(--shadow)",
            cursor: "text",
          }}
        >
          <input
            className="mission-note"
            aria-label="What did you call it? (optional)"
            value={note}
            maxLength={24}
            placeholder="______"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onNote(e.target.value)}
            style={{
              width: note ? "100%" : "7.4ch",
              minWidth: 0,
              border: 0,
              background: "transparent",
              font: `400 ${note.length > 12 ? 17 : 22}px var(--font-display)`,
              letterSpacing: note ? ".02em" : ".3em",
              textAlign: "center",
              textTransform: "uppercase",
            }}
          />
          {!note && <span className="mission-note-cursor anim-blink" aria-hidden style={{ flex: "none", width: 12, height: 28, background: "var(--ink)" }} />}
        </label>
      </div>
    </div>
  );
}

// F1: glanceable from waist height, so two people look at each other, not the
// phone. Done goes to G1. At 30 seconds F3 takes over.
export default function Mission() {
  const { ride, act } = useRide();
  const now = useNow();
  const { match, mission: m } = ride;
  if (!m) return null;
  const { mission } = m;
  const station = meetStationName(ride.checkIn);
  const left = secondsUntil(m.endsAt, now);
  const total = Math.max(1, (m.endsAt - m.startedAt) / 1000);
  const up = left <= 0;

  return (
    <Screen
      label="F1"
      blobs="a"
      footer={
        <>
          <Button onClick={act.missionDone}>
            Done
          </Button>
          <button
            type="button"
            className="q-link mission-swap"
            onClick={act.newPrompt}
            disabled={m.swapped}
            aria-label={m.swapped ? "New prompt already used this quest" : "New prompt (one per quest)"}
          >
            {m.swapped ? "New prompt used" : "New prompt (one per quest)"}
          </button>
        </>
      }
    >
      <MeetTopBar partner={match} />

      {mission.id === "rename-station" && (
        <MissionRenameArt station={station} note={ride.note ?? ""} onNote={act.setNote} />
      )}

      <Card style={{ gap: 6, borderRadius: "var(--r2)" }}>
        <Eyebrow>
          {MISSION_GROUP_LABEL[mission.group].split(" · ")[0]} · {mission.rarity}
        </Eyebrow>
        <h1 className="q-title">
          {missionText(mission.title, { station, name: match?.firstName })}
        </h1>
        <p style={{ fontSize: 21, lineHeight: 1.2, textWrap: "pretty" }}>{mission.body}</p>
      </Card>

      <div style={{ flex: 1, minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <MissionRing left={left} total={total} />
        {up && (
          <p role="status" style={{ font: "700 21px/1.1 var(--font-hand)", textAlign: "center" }}>
            Time's up, wrap it up. Tap Done when you're ready.
          </p>
        )}
      </div>
    </Screen>
  );
}
