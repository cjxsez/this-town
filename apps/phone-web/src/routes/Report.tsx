/**
 * Report.tsx: route /report/:matchId. Report and/or block a match.
 *
 * Responsible for: a short reason (max 280 chars, ReportReq), a "block this person" toggle,
 * and POST /api/report { matchId, reason, block }. Blocking keeps the pair from ever being
 * matched again (matching interest gate). Always one action away from Home while matched.
 *
 * Uses: POST /api/report (ReportReq). matchId comes from the route param, which Home fills
 * from match.found.matchId.
 *
 * TODO:
 * - Reach this after a match has ended (needs a recent-matches route, see README gaps).
 * - Preset reasons (uncomfortable, spam, other) + free text.
 * - Blocking should also drop the current match right away (worker side).
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../lib/api";

export function Report() {
  const { matchId = "" } = useParams();
  const [reason, setReason] = useState("");
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.report({ matchId, reason: reason.trim(), block });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="stack">
        <h1>Thanks for telling us</h1>
        <p className="muted">{block ? "You won't be matched with them again." : "We got your report."}</p>
        <Link className="btn primary" to="/">
          Back to Ride Mode
        </Link>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Report or block</h1>
      <p className="muted">Tell us what happened. Blocking means you never get matched again.</p>
      <textarea
        className="input"
        rows={4}
        maxLength={280}
        placeholder="What happened? (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <label className="row">
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
        Block this person
      </label>
      <button className="btn danger" disabled={!matchId || busy} onClick={() => void submit()}>
        {busy ? "Sending..." : "Send"}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
