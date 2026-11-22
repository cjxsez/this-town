/**
 * Pure end-of-game vote helpers (D29). Next / Again / Finish are votes: the room moves
 * only when both seats pick the same choice. Finish cannot be undone once agreed.
 */
import type { EndChoice, Seat } from "./types";
import { otherSeat } from "./types";

/** Map a room.* action to a vote, or null if that action is not allowed (finish before last). */
export function endChoiceFromAction(
  lastGame: boolean,
  type: "room.next" | "room.again" | "room.finish",
): EndChoice | null {
  if (!lastGame && type === "room.finish") return null;
  if (lastGame) return "finish";
  return type === "room.again" ? "again" : "next";
}

/**
 * Record one seat's pick. `consensus` is set only when both seats have the same choice.
 * A split vote leaves consensus null (the room waits).
 */
export function applyEndVote(
  current: Partial<Record<Seat, EndChoice>>,
  seat: Seat,
  choice: EndChoice,
): { votes: Partial<Record<Seat, EndChoice>>; consensus: EndChoice | null } {
  const votes = { ...current, [seat]: choice };
  const partner = votes[otherSeat(seat)];
  return { votes, consensus: partner === choice ? choice : null };
}

/** Once finished, further end votes must not restart the playlist. */
export function canAcceptEndVote(finished: boolean, gameDone: boolean): boolean {
  return !finished && gameDone;
}
