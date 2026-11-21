import { BADGE_COLORS, DIRECTIONS, LINES, stationById } from "../../../../shared/catalog";
import type { CheckIn, Match } from "../../../../shared/types";
import { LinePill, TrainPill } from "../../../ui";
import { clock, secondsUntil } from "../../../state/format";
import { useNow } from "../../../state/useNow";
import { useRide } from "../../../state/store";

/** "GREEN B · WESTBOUND" from the rider's check-in. */
export function meetLineLabel(c: CheckIn | undefined): string {
  if (!c) return "";
  const dir = DIRECTIONS[c.line].find((d) => d.id === c.direction)?.label ?? c.direction;
  return `${LINES[c.line].label}${c.branch ? ` ${c.branch}` : ""} · ${dir}`;
}

/** "Kenmore" for the checked-in station. */
export const meetStationName = (c: CheckIn | undefined) => (c && stationById(c.stationId)?.name) || "this station";

/** "TRAIN 3:00", live. The train always wins, so this is on every quest screen. */
export function MeetTrainPill() {
  const { ride } = useRide();
  const now = useNow();
  const left = clock(secondsUntil(ride.trainAt, now));
  return (
    <span role="timer" aria-label={`Train in ${left}`}>
      <TrainPill>
        TRAIN {ride.online ? "" : "~"}
        {left}
      </TrainPill>
    </span>
  );
}

/** Top bar: line pill (E1–E3) or "with Maya" pill (F1), plus the train countdown. */
export function MeetTopBar({ partner }: { partner?: Match }) {
  const { ride } = useRide();
  const c = ride.checkIn;
  return (
    <div className="q-topbar">
      {partner ? (
        <span className="q-pill">
          <span className="q-pill__dot" style={{ background: BADGE_COLORS[partner.badge.color] }} />
          with {partner.firstName}
        </span>
      ) : c ? (
        <LinePill line={c.line}>{meetLineLabel(c)}</LinePill>
      ) : (
        <span />
      )}
      <MeetTrainPill />
    </div>
  );
}
