// What the right-eye lens shows for a given ride state. The glasses hold no
// logic: the phone derives one card and replaces the whole card on every
// change. Timers are coarse because the Bluetooth link can't redraw often.
import { DIRECTIONS, LINES, badgeName, missionText } from "../../../shared/catalog";
import type { LensCard } from "../../../shared/types";
import { capitalize } from "../../state/format";
import type { RideState } from "../../state/ride";

/**
 * Snap a countdown to the lens buckets. The label only changes when the
 * countdown crosses 2:00, 1:00, 0:30 and 0:10 (and once a minute above 2:00),
 * so the card isn't redrawn every second.
 */
export function coarseTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s > 120) return `${Math.ceil(s / 60)} min left`;
  if (s > 60) return "2 min left";
  if (s > 30) return "1 min left";
  if (s > 10) return "30 s";
  return "10 s";
}

/** The same buckets without "left", for "TRAIN 3 min" / "Train in 2 min". */
const coarseTrain = (seconds: number) => coarseTime(seconds).replace(" left", "");

const untilSec = (at: number | undefined, now: number) => (at === undefined ? 0 : Math.max(0, (at - now) / 1000));
const noStop = (s: string) => s.trim().replace(/[.!]+$/, "");
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function lensCardFor(ride: RideState, stationName: string, profileHasGlasses: boolean, now = Date.now()): LensCard | null {
  if (!profileHasGlasses) return null;
  const train = coarseTrain(untilSec(ride.trainAt, now));

  // The train always wins: the takeover replaces whatever is on the lens.
  if (ride.trainSoon) return { kind: "trainSoon", seconds: Math.ceil(untilSec(ride.trainAt, now)) };

  const m = ride.match;
  switch (ride.phase) {
    case "waiting": {
      const c = ride.checkIn;
      if (!c) return null;
      const line = `${LINES[c.line].label}${c.branch ? ` ${c.branch}` : ""}`;
      const direction = DIRECTIONS[c.line].find((d) => d.id === c.direction)?.label ?? c.direction;
      return { kind: "waiting", line, direction, trainIn: train };
    }
    case "offer":
    case "offerYes":
      return ride.offer ? { kind: "offer", why: noStop(ride.offer.why), minutes: ride.offer.minutes } : null;
    case "meet":
    case "cantSpot":
      if (!m) return null;
      return {
        kind: "meet",
        name: m.firstName,
        badge: capitalize(badgeName(m.badge)),
        spot: ride.meetSpot ? `At ${lowerFirst(ride.meetSpot.name)}` : "Look for their badge",
        train,
      };
    case "greeting":
      if (!m) return null;
      return { kind: "greeting", name: m.firstName, opener: ride.opener?.say ?? "Hi!", train };
    case "mission":
      if (!ride.mission) return null;
      return {
        kind: "mission",
        title: noStop(missionText(ride.mission.mission.title, { station: stationName, name: m?.firstName })),
        left: coarseTime(untilSec(ride.mission.endsAt, now)),
        train,
      };
    case "bump":
    case "stamp":
      if (!m) return null;
      return { kind: "stamp", station: stationName, name: m.firstName, askPhoto: ride.phase === "stamp" };
    default:
      return null;
  }
}

/** Stable identity for "did the card change?" (every change is a full redraw). */
export const lensKey = (card: LensCard | null) => (card ? JSON.stringify(card) : "none");
