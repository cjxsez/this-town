/**
 * The trolley's timetable. It waits at each stop, pulls out gently, runs to the
 * next stop and brakes into it, for ever. A pure function of time so a frozen
 * frame always shows the train in the same place.
 */
export interface Timetable {
  /** Stop positions around the loop, ascending. */
  readonly stopsDeg: readonly number[];
  readonly legSeconds: number;
  readonly dwellSeconds: number;
  /** How far into the timetable the train is at time 0. */
  readonly startSeconds: number;
}

/** Angle of the middle of the train. Keeps counting past 360 on later laps. */
export function trainCenterDeg(seconds: number, timetable: Timetable): number {
  const { stopsDeg, legSeconds, dwellSeconds, startSeconds } = timetable;
  const stops = stopsDeg.length;
  const slot = dwellSeconds + legSeconds;
  const lap = stops * slot;

  const clock = seconds + startSeconds;
  const laps = Math.floor(clock / lap);
  const inLap = clock - laps * lap;
  const stop = Math.min(stops - 1, Math.floor(inLap / slot));
  const inSlot = inLap - stop * slot;

  const from = stopsDeg[stop]!;
  const to = stop + 1 < stops ? stopsDeg[stop + 1]! : stopsDeg[0]! + 360;
  const u = inSlot <= dwellSeconds ? 0 : (inSlot - dwellSeconds) / legSeconds;
  const eased = u * u * (3 - 2 * u);
  return laps * 360 + from + (to - from) * eased;
}
