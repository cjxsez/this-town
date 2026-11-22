/**
 * The intro and the "after BEGIN" sequence as pure functions of time.
 *
 * Nothing here keeps state: the same time always returns the same numbers. That is
 * what makes `?t=1.2` (freeze the intro at 1.2s) show an exact, repeatable frame.
 * The numbers are progress values, 0 = not started, 1 = at rest; curves that
 * overshoot (EASE.arrive) pass 1 on the way. The scene turns them into positions.
 * When input turns on and when the screen is finished are the clock's business
 * (core/clock.ts).
 */
import type { Bezier, Config } from "../config";
import { cubicBezier } from "./ease";

export interface Span {
  readonly start: number;
  readonly dur: number;
  readonly ease: Bezier;
}

const LINEAR: Bezier = [0, 0, 1, 1];
/** Float sums like 0.1 + 1.3 land a hair past 1.4; treat that as "finished". */
const EPSILON = 1e-9;

const curves = new Map<Bezier, (x: number) => number>();
function curve(ease: Bezier): (x: number) => number {
  let f = curves.get(ease);
  if (!f) curves.set(ease, (f = cubicBezier(ease)));
  return f;
}

/** 0 until the span starts, 1 once it has finished, eased in between. */
export function progress(t: number, span: Span): number {
  if (t <= span.start) return 0;
  if (t >= span.start + span.dur - EPSILON) return 1;
  return curve(span.ease)((t - span.start) / span.dur);
}

export interface IntroState {
  /** 1 = doors shut, 0 = fully open. */
  cover: number;
  /** Island coming up, growing, and turning to its resting angle. */
  rise: number;
  grow: number;
  spin: number;
  foam: number;
  /** Per tile: how far through its flip, and how far through growing from nothing. */
  tiles: number[];
  tilePop: number[];
  button: number;
}

const tileStart = (intro: Config["intro"], index: number) => intro.tile.start + index * intro.tileStagger;

/** The time at which every part of the intro has come to rest. */
export function introEnd(intro: Config["intro"], tileCount: number): number {
  const ends = [intro.doors, intro.rise, intro.grow, intro.spin, intro.foam, intro.button].map((s) => s.start + s.dur);
  if (tileCount > 0) ends.push(tileStart(intro, tileCount - 1) + intro.tile.dur);
  return Math.max(intro.inputAt, ...ends);
}

export function introState(t: number, intro: Config["intro"], tileCount: number): IntroState {
  const tiles: number[] = [];
  const tilePop: number[] = [];
  for (let i = 0; i < tileCount; i++) {
    const start = tileStart(intro, i);
    tiles.push(progress(t, { start, dur: intro.tile.dur, ease: intro.tile.ease }));
    tilePop.push(progress(t, { start, dur: intro.tilePopSeconds, ease: LINEAR }));
  }
  return {
    cover: 1 - progress(t, intro.doors),
    rise: progress(t, intro.rise),
    grow: progress(t, intro.grow),
    spin: progress(t, intro.spin),
    foam: progress(t, intro.foam),
    tiles,
    tilePop,
    button: progress(t, intro.button),
  };
}

/**
 * Idle coin spin of the `index`th roundel, in radians (0 when resting). Starts one
 * interval after the intro has come to rest; a pure function of time like the rest.
 */
export function roundelIdleTurn(
  t: number,
  restAt: number,
  index: number,
  r: { idleEverySeconds: number; idleSpinSeconds: number; idleStaggerSeconds: number; idleEase: Bezier },
): number {
  const since = t - restAt - index * r.idleStaggerSeconds;
  if (since < r.idleEverySeconds) return 0;
  const inCycle = since % r.idleEverySeconds;
  if (inCycle >= r.idleSpinSeconds) return 0;
  return Math.PI * 2 * curve(r.idleEase)(inCycle / r.idleSpinSeconds);
}

/**
 * How shut the doors are `t` seconds after onBegin() when revealing the next page:
 * 1 while they hold shut, then easing open to 0.
 */
export function revealCover(t: number, r: { holdSeconds: number; openSeconds: number; ease: Bezier }): number {
  return 1 - progress(t, { start: r.holdSeconds, dur: r.openSeconds, ease: r.ease });
}

export interface OutroState {
  /** Per tile: 0 = still in place, 1 = gone. */
  tiles: number[];
  button: number;
  /** Camera dropping in towards the island. */
  dive: number;
  /** 0 = doors open, 1 = shut. */
  cover: number;
}

/** `t` is seconds since BEGIN was pressed. */
export function outroState(t: number, outro: Config["outro"], tileCount: number): OutroState {
  const tiles: number[] = [];
  for (let i = 0; i < tileCount; i++) {
    // Last letter first.
    const start = outro.tile.start + (tileCount - 1 - i) * outro.tileStagger;
    tiles.push(progress(t, { start, dur: outro.tile.dur, ease: outro.tile.ease }));
  }
  return {
    tiles,
    button: progress(t, outro.button),
    dive: progress(t, outro.dive),
    cover: progress(t, outro.doors),
  };
}
