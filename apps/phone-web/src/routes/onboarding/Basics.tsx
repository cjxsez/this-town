/**
 * Basics.tsx: onboarding step 1. First name and the 18+ confirmation.
 *
 * Responsible for: Profile.firstName (1-24 chars, first name only, no last names or photos)
 * and Profile.is18Plus (must be true; under-18s cannot continue).
 *
 * Uses: no routes or events. OnboardingFlow posts the finished profile.
 *
 * TODO:
 * - Short copy on why first names only (the kiosk screen is public).
 * - Under-18 dead end screen instead of just a disabled button.
 */
import type { StepProps } from "./types";

export function BasicsStep({ draft, update, onNext }: StepProps) {
  const ok = draft.firstName.trim().length > 0 && draft.is18Plus;
  return (
    <section className="stack">
      <h1>Hi! What should people call you?</h1>
      <p className="muted">First name only. It is all your match and the kiosk screen will see.</p>
      <input
        className="input"
        autoComplete="given-name"
        maxLength={24}
        placeholder="First name"
        value={draft.firstName}
        onChange={(e) => update({ firstName: e.target.value })}
      />
      <label className="row">
        <input
          type="checkbox"
          checked={draft.is18Plus}
          onChange={(e) => update({ is18Plus: e.target.checked })}
        />
        I am 18 or older
      </label>
      <button className="btn primary" disabled={!ok} onClick={onNext}>
        Continue
      </button>
    </section>
  );
}
