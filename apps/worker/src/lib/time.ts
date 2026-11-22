/**
 * lib/time.ts: time constants and small helpers. Everything is epoch ms unless the name
 * ends in Sec.
 *
 * Responsible for:
 * - Unit constants (SECOND, MINUTE, DAY).
 * - `secondsUntil()`: ms deadline -> whole seconds remaining (never negative), used for
 *   RideState.nextStopEtaSec and KioskIdleEvent.nextStopEtaSec.
 * - Room timing constants shared by TrainRoom, matching and missions.
 *
 * Protocol types: none.
 *
 * TODO:
 * - Tune the room constants after the first on-train test.
 */

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const DAY = 24 * 60 * MINUTE;

/** Missions must end this long before the next stop (architecture: next stop minus 30 s). */
export const MISSION_END_BUFFER_MS = 30 * SECOND;
/** Alarm cadence while anyone is checked in or a kiosk is connected (architecture: 15 to 30 s). */
export const ALARM_INTERVAL_MS = 20 * SECOND;
/** Start the mission this long after the match if the second rider has not "arrived". */
export const MISSION_AUTOSTART_DELAY_MS = 20 * SECOND;
/** Stamp taps are accepted until mission.endsAt plus this grace. */
export const STAMP_GRACE_MS = 15 * SECOND;
/** Matching skips pairs who met within this window. */
export const MET_RECENTLY_WINDOW_MS = 7 * DAY;
/** Glasses link codes live this long. */
export const GLASSES_CODE_TTL_MS = 5 * MINUTE;
/** Email sign-in: how long a code works, how often one can be sent, wrong guesses allowed. */
export const LOGIN_CODE_TTL_MS = 10 * MINUTE;
export const LOGIN_CODE_RESEND_MS = 30 * SECOND;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
/** A verified new email has this long to finish onboarding. */
export const SIGNUP_TICKET_TTL_MS = 30 * MINUTE;

export function secondsUntil(deadlineMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.round((deadlineMs - nowMs) / SECOND));
}
