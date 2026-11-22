/**
 * The clock for the live platform scene in the app's ride screens. It returns
 * "timetable seconds": 0 is the moment the trolley stops in front of you,
 * negative is before, and it stands there until `dwellSeconds`.
 */
export interface PlatformTiming {
  /** Seconds for the trolley to go once round the loop. */
  readonly legSeconds: number;
  /** Seconds it stands at the platform. */
  readonly dwellSeconds: number;
  /** "loop": the first train pulls in this long after the scene appears. */
  readonly leadInSeconds: number;
  /** "arrive": until its last seconds the train is held this far into its lap (0..1), out of sight. */
  readonly holdAt: number;
}

export interface PlatformClockInput {
  /** "loop": trains keep coming. "arrive": one train comes in at a set time and stays. */
  mode: "loop" | "arrive";
  /** Seconds since the scene appeared. */
  elapsed: number;
  /** "arrive": seconds until the train is due (negative once it has come). Without it, it comes in straight away. */
  untilArrival?: number;
  reducedMotion: boolean;
}

export function platformClock(i: PlatformClockInput, t: PlatformTiming): number {
  const standing = t.dwellSeconds / 2;
  if (i.reducedMotion) return standing;
  if (i.mode === "loop") return i.elapsed - t.leadInSeconds;
  const until = i.untilArrival ?? t.leadInSeconds - i.elapsed;
  return Math.min(standing, Math.max(-t.legSeconds * t.holdAt, 0 - until));
}
