/**
 * Fires named cues as a clock passes them. This is the hook for sounds: there is
 * no audio yet, but every moment a sound belongs on already calls out here.
 */
export class CueTrack<N extends string> {
  private readonly cues: ReadonlyArray<{ readonly name: N; readonly at: number }>;
  private next = 0;

  constructor(
    cues: ReadonlyArray<{ readonly name: N; readonly at: number }>,
    private readonly fire: (name: N) => void,
  ) {
    this.cues = [...cues].sort((a, b) => a.at - b.at);
  }

  /** Call with the current clock time; each cue fires once when the clock reaches it. */
  advance(t: number): void {
    for (let cue = this.cues[this.next]; cue && cue.at <= t; cue = this.cues[this.next]) {
      this.next++;
      this.fire(cue.name);
    }
  }
}
