/**
 * SocialBattery.tsx: onboarding step 4. How much talking you are up for.
 *
 * Responsible for: Profile.socialBattery, one of the protocol SocialBattery values
 * "nod" | "quick-chat" | "lets-talk". Used as a matching tie-breaker.
 *
 * Uses: no routes or events.
 *
 * TODO:
 * - Let riders change this per ride from Home (needs a worker route, see README gaps).
 */
import type { SocialBattery } from "@questline/protocol";
import type { StepProps } from "./types";

const OPTIONS: { value: SocialBattery; label: string; hint: string }[] = [
  { value: "nod", label: "A nod", hint: "Quick hello, then back to my podcast" },
  { value: "quick-chat", label: "Quick chat", hint: "Happy to talk for a stop or two" },
  { value: "lets-talk", label: "Let's talk", hint: "I am here for it" },
];

export function SocialBatteryStep({ draft, update, onNext, onBack }: StepProps) {
  return (
    <section className="stack">
      <h1>Social battery</h1>
      <p className="muted">How much talking are you usually up for on the train?</p>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          className={draft.socialBattery === o.value ? "option on" : "option"}
          onClick={() => update({ socialBattery: o.value })}
        >
          <strong>{o.label}</strong>
          <span className="muted">{o.hint}</span>
        </button>
      ))}
      <div className="row">
        {onBack && (
          <button className="btn" onClick={onBack}>
            Back
          </button>
        )}
        <button className="btn primary" disabled={!draft.socialBattery} onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}
