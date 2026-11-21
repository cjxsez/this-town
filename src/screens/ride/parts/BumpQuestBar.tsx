import { BADGE_COLORS } from "../../../../shared/catalog";
import { TrainPill } from "../../../ui";
import { clock, secondsUntil } from "../../../state/format";
import { useNow } from "../../../state/useNow";
import { useRide } from "../../../state/store";

/**
 * "WITH MAYA" + "TRAIN 1:10" bar for G1–G3. The train always wins, so the
 * countdown stays on screen until the quest lands on the train.
 */
export function BumpQuestBar() {
  const { ride } = useRide();
  const now = useNow();
  const m = ride.match;
  const left = clock(secondsUntil(ride.trainAt, now));
  return (
    <div className="q-topbar">
      {m ? (
        <span className="q-pill">
          <span className="q-pill__dot" style={{ background: BADGE_COLORS[m.badge.color] }} />
          with {m.firstName}
        </span>
      ) : (
        <span />
      )}
      <span role="timer" aria-label={`Train in ${left}`}>
        <TrainPill>
          TRAIN {ride.online ? "" : "~"}
          {left}
        </TrainPill>
      </span>
    </div>
  );
}
