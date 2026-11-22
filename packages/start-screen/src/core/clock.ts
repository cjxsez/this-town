/**
 * The two clocks the start screen runs on, and the rules for when they move.
 *
 * - `t`: seconds on the intro clock. It keeps running after the intro, because the
 *   camera orbit and the train read it too.
 * - `outT`: seconds since BEGIN was pressed, or null before that.
 *
 * Freezing (`?t=`, `?out=`) holds both still and fires no sound cues, so a frozen
 * frame is always the same frame. Reduced motion skips the intro (and its cues)
 * and holds the world still, but BEGIN still closes the doors.
 */
import { CueTrack } from "./cues";

export interface ClockOptions {
  /** Hold the intro clock here. null = run. */
  freezeAt: number | null;
  /** Hold the after-BEGIN clock here. null = run. */
  freezeOutroAt: number | null;
  reducedMotion: boolean;
  /** When the intro has fully come to rest. */
  restAt: number;
  /** When pointer and keyboard input turn on. */
  inputAt: number;
  /** How long after BEGIN the screen is finished. */
  doneAt: number;
}

type Cue<N> = { readonly name: N; readonly at: number };

export class StartClock<I extends string, O extends string> {
  t: number;
  outT: number | null;
  /** True when either clock is held by a freeze option. */
  readonly frozen: boolean;
  private begun: boolean;
  private readonly introCues: CueTrack<I>;
  private readonly outroCues: CueTrack<O>;

  constructor(
    private readonly options: ClockOptions,
    cues: { intro: ReadonlyArray<Cue<I>>; outro: ReadonlyArray<Cue<O>> },
    fire: (name: I | O) => void,
  ) {
    const { freezeAt, freezeOutroAt, reducedMotion, restAt } = options;
    this.frozen = freezeAt !== null || freezeOutroAt !== null;
    this.t = freezeAt ?? (reducedMotion || freezeOutroAt !== null ? restAt : 0);
    this.outT = freezeOutroAt;
    this.begun = freezeOutroAt !== null;
    this.introCues = new CueTrack(cues.intro, fire);
    this.outroCues = new CueTrack(cues.outro, fire);
  }

  /** Can the pointer and keyboard do anything right now? */
  get inputOn(): boolean {
    return !this.begun && this.t >= this.options.inputAt;
  }

  /** Has the after-BEGIN sequence run to its end? (Never, when frozen.) */
  get finished(): boolean {
    return !this.frozen && this.outT !== null && this.outT >= this.options.doneAt - 1e-9;
  }

  /** Start the after-BEGIN clock. Returns false if it was not allowed to. */
  begin(): boolean {
    if (this.frozen || !this.inputOn) return false;
    this.begun = true;
    this.outT = 0;
    return true;
  }

  tick(dt: number): void {
    if (this.frozen) return;
    if (!this.options.reducedMotion) {
      this.t += dt;
      this.introCues.advance(this.t);
    }
    if (this.outT !== null) {
      this.outT += dt;
      this.outroCues.advance(this.outT);
    }
  }
}
