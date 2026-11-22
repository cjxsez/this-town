/**
 * A damped spring: `value` chases `target`. Used for everything that answers the
 * pointer (tilt, lift, flap, press), so motion keeps its momentum when the target
 * changes mid-way instead of restarting like a tween would.
 */
const SUBSTEP = 1 / 240;
const LONGEST_STEP = 2;

export class Spring {
  value: number;
  velocity = 0;
  target: number;
  private readonly stiffness: number;
  private readonly damping: number;

  constructor(options: { stiffness: number; damping: number; value?: number }) {
    this.stiffness = options.stiffness;
    this.damping = options.damping;
    this.value = options.value ?? 0;
    this.target = this.value;
  }

  /** Advance by `dt` seconds. Fixed small substeps keep it stable at any frame rate. */
  step(dt: number): number {
    let remaining = Math.min(dt, LONGEST_STEP);
    while (remaining > 1e-9) {
      const h = Math.min(SUBSTEP, remaining);
      const acceleration = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += acceleration * h;
      this.value += this.velocity * h;
      remaining -= h;
    }
    return this.value;
  }

  snap(value: number): void {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }
}
