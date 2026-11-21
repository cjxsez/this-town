/**
 * StampCard.tsx: one passport stamp.
 *
 * Responsible for: showing a Stamp (station, line, partner first name, rare flag, date).
 * First names only, per the safety rules.
 *
 * Uses: no routes or events itself. Rendered by Passport (GET /api/passport stamps[]),
 * Tap (TapRes "stamp-awarded") and Home (stamp.awarded event via useRide).
 *
 * TODO:
 * - Line color accent (Red/Orange/Blue/Green-*), real stamp artwork, rare treatment.
 */
import type { Stamp } from "@questline/protocol";

interface Props {
  stamp: Stamp;
}

export function StampCard({ stamp }: Props) {
  const date = new Date(stamp.awardedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <article className="card stamp-card">
      <h3>
        {stamp.station} {stamp.rare && <span className="tag">rare</span>}
      </h3>
      <p className="muted">
        {stamp.line} line, with {stamp.partnerFirstName}, {date}
      </p>
    </article>
  );
}
