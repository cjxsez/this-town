/**
 * Interests.tsx: onboarding step 2. Pick 3 to 5 InterestTag values.
 *
 * Responsible for: Profile.interests (min 3, max 5, values from the protocol InterestTag enum).
 * These drive the matching interest gate and the "why you two" line.
 *
 * Uses: no routes or events. InterestTag.options from @questline/protocol for the chip list.
 *
 * TODO:
 * - Human labels + emoji-free icons per tag ("ai" -> "AI").
 * - Group tags (food & drink, outdoors, creative, ...) if the list feels long.
 */
import { InterestTag } from "@questline/protocol";
import type { StepProps } from "./types";

const MIN = 3;
const MAX = 5;

export function InterestsStep({ draft, update, onNext, onBack }: StepProps) {
  const picked = draft.interests;

  const toggle = (tag: InterestTag) => {
    if (picked.includes(tag)) update({ interests: picked.filter((t) => t !== tag) });
    else if (picked.length < MAX) update({ interests: [...picked, tag] });
  };

  return (
    <section className="stack">
      <h1>What are you into?</h1>
      <p className="muted">
        Pick {MIN} to {MAX}. You only get matched with riders who share at least one.
      </p>
      <div className="chips">
        {InterestTag.options.map((tag) => (
          <button
            key={tag}
            className={picked.includes(tag) ? "chip on" : "chip"}
            onClick={() => toggle(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="row">
        {onBack && (
          <button className="btn" onClick={onBack}>
            Back
          </button>
        )}
        <button className="btn primary" disabled={picked.length < MIN} onClick={onNext}>
          Continue ({picked.length}/{MAX})
        </button>
      </div>
    </section>
  );
}
