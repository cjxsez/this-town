import { PAIR_COLOR_HEX } from "@questline/protocol/colors";
import type { CheckIn, Match } from "../../../../shared/types";
import { LinePill, TrainPill } from "../../../ui";
import { clock, secondsUntil } from "../../../state/format";
import { useNow } from "../../../state/useNow";
import { useRide } from "../../../state/store";
import { lineLabel } from "./PlatformKit";

/** "Hynes" for the stop the train is heading to. */
export const meetStationName = (c: CheckIn | undefined) => c?.nextStationName || "the next stop";

/** "HYNES 3:00", live. Missions end 30 s before it, so it's on every quest screen. */
export function MeetTrainPill() {
  const { ride } = useRide();
  const now = useNow();
  const left = clock(secondsUntil(ride.nextStopAt, now));
  const stop = meetStationName(ride.checkIn).toUpperCase();
  return (
    <span role="timer" aria-label={`${stop} in ${left}`}>
      <TrainPill>
        {stop} {ride.online ? "" : "~"}
        {left}
      </TrainPill>
    </span>
  );
}

/** Top bar: line and car (E1) or "with Maya" in the pair color (F1), plus the next stop countdown. */
export function MeetTopBar({ partner }: { partner?: Match }) {
  const { ride } = useRide();
  const c = ride.checkIn;
  return (
    <div className="q-topbar">
      {partner ? (
        <span className="q-pill">
          <span className="q-pill__dot" style={{ background: PAIR_COLOR_HEX[partner.color] }} />
          with {partner.firstName}
        </span>
      ) : c ? (
        <LinePill line={c.line}>{lineLabel(c)}</LinePill>
      ) : (
        <span />
      )}
      <MeetTrainPill />
    </div>
  );
}
