import { useState } from "react";
import { Link } from "react-router";
import { tStation } from "@questline/t-map";
import { Screen } from "../../ui";
import { useApp } from "../../state/store";
import { shortDate } from "../../state/format";
import { LINES } from "../../../shared/catalog";
import type { Stamp } from "../../../shared/types";
import { PaperBack } from "./parts";
import { MapViewer } from "./MapViewer";

const LINE_NAME = { red: "Red", mattapan: "Mattapan", orange: "Orange", blue: "Blue", green: "Green" } as const;
const DOT = { red: LINES.red.hex, mattapan: LINES.red.hex, orange: LINES.orange.hex, blue: LINES.blue.hex, green: LINES.green.hex } as const;

/**
 * H7 The T map: the whole network as the MBTA's diagram draws it, every station named,
 * stamped ones in yellow. Opens on the rider's newest stamp.
 */
export default function MapScreen() {
  const { state } = useApp();
  const [picked, setPicked] = useState<string | null>(null);
  const stamps = state.stamps;
  const stamped = [...new Set(stamps.map((s) => s.stationId))];
  const newest = [...stamps].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))[0];
  const station = picked ? tStation(picked) : undefined;
  const stamp = picked ? bestStamp(stamps.filter((s) => s.stationId === picked)) : undefined;

  return (
    <Screen blobs={false} label="H7" bodyStyle={{ paddingBottom: 0, gap: 10 }}>
      <div className="cl-maphead">
        <PaperBack to="/passport">PASSPORT</PaperBack>
        <div className="cl-sub">
          {stamped.length} of 124 stations
        </div>
      </div>
      <MapViewer stamped={stamped} focus={newest?.stationId} picked={picked} onPick={setPicked} />
      {station && (
        <div className="cl-pick" role="dialog" aria-label={station.name}>
          <div className="cl-pick__head">
            <h2 className="q-title--sm" style={{ margin: 0 }}>
              {station.name}
            </h2>
            <button type="button" className="cl-pick__close" aria-label="Close" onClick={() => setPicked(null)}>
              ×
            </button>
          </div>
          <div className="cl-pick__lines">
            {station.lines.map((l) => (
              <span key={l} className="q-pill">
                <span className="q-pill__dot" style={{ background: DOT[l] }} />
                {LINE_NAME[l]}
                {l === "green" && station.branches ? ` ${station.branches.join(" ")}` : ""}
              </span>
            ))}
          </div>
          <p className="cl-pick__note">
            {station.suspended ?? (station.accessible ? "Accessible" : "Not accessible: stairs only")}
          </p>
          {stamp ? (
            <Link className="cl-pick__stamp" to={`/passport/${stamp.id}`}>
              Stamped {shortDate(stamp.earnedAt)}
              {stamp.rare ? " · rare ★" : ""}. See the stamp
            </Link>
          ) : (
            <p className="cl-pick__note">No stamp here yet.</p>
          )}
        </div>
      )}
    </Screen>
  );
}

function bestStamp(list: Stamp[]): Stamp | undefined {
  return [...list].sort((a, b) => Number(b.rare) - Number(a.rare) || b.earnedAt.localeCompare(a.earnedAt))[0];
}
