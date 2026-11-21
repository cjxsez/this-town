/**
 * LocalOrVisitor.tsx: onboarding step 5 (last). Local, student or visitor.
 *
 * Responsible for: Profile.status, one of the protocol RiderStatus values
 * "local" | "student" | "visitor". The final "Finish" button triggers OnboardingFlow's
 * POST /api/users.
 *
 * Uses: no routes or events directly.
 *
 * TODO:
 * - Profile.languages (max 5) has no step yet; add an optional picker here or its own step.
 */
import type { RiderStatus } from "@questline/protocol";
import type { StepProps } from "./types";

const OPTIONS: { value: RiderStatus; label: string }[] = [
  { value: "local", label: "Local" },
  { value: "student", label: "Student" },
  { value: "visitor", label: "Visiting Boston" },
];

export function LocalOrVisitorStep({ draft, update, onNext, onBack, busy, isLast }: StepProps) {
  return (
    <section className="stack">
      <h1>Local or visitor?</h1>
      <p className="muted">Helps us pick missions that make sense for both of you.</p>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          className={draft.status === o.value ? "option on" : "option"}
          onClick={() => update({ status: o.value })}
        >
          <strong>{o.label}</strong>
        </button>
      ))}
      <div className="row">
        {onBack && (
          <button className="btn" onClick={onBack} disabled={busy}>
            Back
          </button>
        )}
        <button className="btn primary" disabled={!draft.status || busy} onClick={onNext}>
          {isLast ? (busy ? "Saving..." : "Finish") : "Continue"}
        </button>
      </div>
    </section>
  );
}
