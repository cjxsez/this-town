/**
 * Passport.tsx: route /passport. The rider's collection.
 *
 * Responsible for: GET /api/passport and showing peopleMet, stamp counts by line (byLine),
 * and every stamp as a StampCard (newest first).
 *
 * Uses: GET /api/passport (PassportRes). No socket events (a fresh stamp.awarded shows on
 * Home/Tap; re-fetch on mount is enough here).
 *
 * TODO:
 * - Group stamps by line with line colors, empty state art, rare stamps highlighted.
 * - Pull to refresh.
 */
import { useEffect, useState } from "react";
import { StampCard } from "../components/StampCard";
import { api, errorMessage, type Passport as PassportData } from "../lib/api";

export function Passport() {
  const [data, setData] = useState<PassportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPassport()
      .then(setData)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  return (
    <section className="stack">
      <h1>Passport</h1>
      <p className="muted">Stamps you collected with the people you met on the T.</p>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <p>
            <strong>{data.peopleMet}</strong> people met
          </p>
          <ul className="list">
            {Object.entries(data.byLine).map(([line, count]) => (
              <li key={line}>
                {line}: {count}
              </li>
            ))}
          </ul>
          {data.stamps.length === 0 ? (
            <p className="muted">No stamps yet. Tap a kiosk to start a ride.</p>
          ) : (
            [...data.stamps]
              .sort((a, b) => b.awardedAt - a.awardedAt)
              .map((s) => <StampCard key={s.id} stamp={s} />)
          )}
        </>
      )}
    </section>
  );
}
