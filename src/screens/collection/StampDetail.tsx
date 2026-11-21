import { Link, useParams } from "react-router";
import { AnimalToken, Body, Card, Screen } from "../../ui";
import { useApp } from "../../state/store";
import { shortDate } from "../../state/format";
import { LINES, badgeName, missionById, missionText, stationById } from "../../../shared/catalog";
import type { Stamp, Station } from "../../../shared/types";
import { MemoryPhoto, PaperBack } from "./parts";

const lineLabel = (s: Stamp) => `${LINES[s.line].label}${s.branch ? ` ${s.branch}` : ""}`;
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function StampDetail() {
  const { stampId } = useParams();
  const { state } = useApp();
  const stamp = state.stamps.find((s) => s.id === stampId);
  const station = stamp && stationById(stamp.stationId);

  if (!stamp || !station) {
    return (
      <Screen tabs blobs="b" label="H3">
        <PaperBack to="/passport">PASSPORT</PaperBack>
        <Card>
          <Body>That stamp isn't in your passport.</Body>
        </Card>
      </Screen>
    );
  }

  const person = state.people.find((p) => p.id === stamp.withPersonId);
  const mission = missionById(stamp.missionId);
  const memory = stamp.memoryId ? state.memories.find((m) => m.id === stamp.memoryId && m.status === "kept") : undefined;
  const meta = [lineLabel(stamp), shortDate(stamp.earnedAt), stamp.delayNote].filter(Boolean).join(" · ");

  return (
    <Screen tabs blobs="b" label="H3">
      <PaperBack to="/passport">PASSPORT</PaperBack>

      <BigStamp stamp={stamp} station={station} withName={person?.firstName} number={state.profile?.badge?.number} />

      <div>
        <h1 className="cl-h1">{station.name.toUpperCase()}</h1>
        <p style={{ fontSize: 21, lineHeight: 1.2, margin: "6px 0 0", textWrap: "pretty" }}>{meta}</p>
      </div>

      <Card style={{ rotate: "0.8deg", gap: 6 }}>
        {mission && (
          <>
            <div className="q-eyebrow">MISSION</div>
            <div style={{ font: "700 26px/1.08 var(--font-hand)" }}>
              {missionText(mission.title, { station: station.name, name: person?.firstName }).replace(/\.$/, "")}
            </div>
          </>
        )}
        {person && (
          <>
            <div className="q-eyebrow" style={{ marginTop: 4 }}>
              WITH
            </div>
            <Link to={`/people/${person.id}`} className="cl-with">
              <AnimalToken badge={person.badge} size={42} />
              <span>
                {person.firstName} · {badgeName(person.badge)}
              </span>
            </Link>
          </>
        )}
      </Card>

      {memory && person && <MemoryPhoto memory={memory} name={person.firstName} style={{ flex: 1, minHeight: 150 }} />}
    </Screen>
  );
}

/** The big ticket: station, line, date, who with; the stub carries the barcode and ★ RARE. */
function BigStamp({ stamp, station, withName, number }: { stamp: Stamp; station: Station; withName?: string; number?: number }) {
  const hex = LINES[stamp.line].hex;
  return (
    <div className={`cl-bigstamp${stamp.rare ? " cl-bigstamp--rare" : ""}`} aria-hidden>
      <div className="cl-bigstamp__pos">
        <div className="cl-bigstamp__tilt">
          <div className="cl-bigstamp__ol">
            <div className="cl-bigstamp__paper">
              <div className="cl-bigstamp__main">
                <div className="cl-bigstamp__top">
                  <span>QUESTLINE</span>
                  <span>{lineLabel(stamp).toUpperCase()}</span>
                </div>
                <div className="cl-bigstamp__name">{station.name.toUpperCase()}</div>
                <div className="cl-bigstamp__row">
                  <div style={{ flex: "0 1 104px", minWidth: 64 }}>
                    <div
                      style={{
                        height: 30,
                        background: "#D9DED3",
                        border: "2px solid var(--ink)",
                        borderRadius: "12px 5px 3px 3px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, background: hex }} />
                      <div
                        style={{
                          position: "absolute",
                          left: 8,
                          right: 8,
                          top: 11,
                          height: 9,
                          background: "repeating-linear-gradient(90deg,var(--sea) 0 12px,#D9DED3 12px 16px)",
                          border: "1.5px solid var(--ink)",
                        }}
                      />
                    </div>
                    <div style={{ borderTop: "2px solid var(--ink)", marginTop: 4 }} />
                    <div style={{ height: 4, background: "repeating-linear-gradient(90deg,var(--ink) 0 2px,#0000 2px 9px)" }} />
                  </div>
                  <div className="cl-bigstamp__when">
                    {longDate(stamp.earnedAt)}
                    {withName && (
                      <>
                        <br />
                        with {withName}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="cl-bigstamp__stub">
                <div className="cl-bigstamp__bars" />
                <div className="cl-bigstamp__rare">{stamp.rare ? "★ RARE" : "STAMP"}</div>
                {number !== undefined && <div className="cl-bigstamp__no">No. {String(number).padStart(4, "0")}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
