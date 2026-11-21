/**
 * AskMeAbout.tsx: onboarding step 3. Optional "ask me about" line.
 *
 * Responsible for: Profile.askMeAbout (max 80 chars, may be empty). Used as a tie-breaker in
 * matching and as material for the "why you two" line. Never shown on the public kiosk.
 *
 * Uses: no routes or events.
 *
 * TODO:
 * - Rotating placeholder examples ("the best ramen in Allston", "my marathon training").
 */
import type { StepProps } from "./types";

export function AskMeAboutStep({ draft, update, onNext, onBack }: StepProps) {
  return (
    <section className="stack">
      <h1>Ask me about...</h1>
      <p className="muted">One line a stranger could open with. Optional.</p>
      <input
        className="input"
        maxLength={80}
        placeholder="the best ramen in Allston"
        value={draft.askMeAbout}
        onChange={(e) => update({ askMeAbout: e.target.value })}
      />
      <div className="row">
        {onBack && (
          <button className="btn" onClick={onBack}>
            Back
          </button>
        )}
        <button className="btn primary" onClick={onNext}>
          {draft.askMeAbout.trim() ? "Continue" : "Skip"}
        </button>
      </div>
    </section>
  );
}
