import { PAIR_COLOR_HEX } from "@questline/protocol/colors";
import { sim } from "../../api";
import { Button, Card, Eyebrow, Screen, TextLink } from "../../ui";
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

/**
 * F1: the mission. The kiosk screen is the main surface; the phone mirrors it so it reads
 * from waist height. The stamp is both riders tapping the kiosk tag, so the footer is that
 * instruction and the 1-of-2 progress. It always ends 30 s before the next stop.
 */
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
  const hex = match ? PAIR_COLOR_HEX[match.color] : "var(--leaf)";
  const name = match?.firstName ?? "your match";
  const tapLine =
    ride.taps === 0
      ? "When you're done, both tap the kiosk tag for your stamp."
      : ride.youTapped
        ? `1 of 2 tapped. Waiting for ${name}.`
        : `${name} tapped. Your turn: tap the kiosk tag.`;

  return (
    <Screen
      label="F1"
      blobs="a"
      footer={
        <>
          <Card style={{ gap: 8 }}>
            <Eyebrow>Stamp</Eyebrow>
            <div style={{ font: "700 22px/1.1 var(--font-hand)" }}>{tapLine}</div>
            <div aria-hidden style={{ display: "flex", gap: 6 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ flex: 1, height: 14, borderRadius: 7, border: "var(--ol) solid var(--ink)", background: i < ride.taps ? hex : "var(--paper-hi)" }} />
              ))}
            </div>
            {sim && ride.meet && !ride.youTapped && (
              <TextLink small to={`/k/${ride.meet.car}`}>
                demo: tap the kiosk tag →
              </TextLink>
            )}
          </Card>
          {match?.game && (
            <>
              <Button variant="secondary" to={`/m?code=${match.game.code}&seat=${match.game.seat}`}>
                Play a game together
              </Button>
              <TextLink small to={`/m?code=${match.game.code}&seat=${match.game.seat}&glasses`}>
                Play it on my glasses
              </TextLink>
            </>
          )}
        </>
      }
    >
      <MeetTopBar partner={match} />

      {(mission.id === "rename-station" || mission.id === "create-rename-station") && (
        <MissionRenameArt station={station} note={ride.note ?? ""} onNote={act.setNote} />
      )}

      <Card style={{ gap: 6, borderRadius: "var(--r2)" }}>
        <Eyebrow>
          {MISSION_GROUP_LABEL[mission.group].split(" · ")[0]} · {mission.rarity}
        </Eyebrow>
        <h1 className="q-title">
          {missionText(mission.title, { station, name: match?.firstName, color: match?.color })}
        </h1>
        <p style={{ fontSize: 21, lineHeight: 1.2, textWrap: "pretty" }}>{mission.body}</p>
      </Card>

      <div style={{ flex: 1, minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <MissionRing left={left} total={total} />
        {up && (
          <p role="status" style={{ font: "700 21px/1.1 var(--font-hand)", textAlign: "center" }}>
            Time's up. Tap the tag now if you want the stamp.
          </p>
        )}
      </div>
    </Screen>
  );
}
