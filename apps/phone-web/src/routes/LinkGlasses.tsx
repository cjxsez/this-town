/**
 * LinkGlasses.tsx: route /link. Pair the rider's Meta Ray-Ban Display glasses.
 *
 * The glasses have no text input, so glasses-web calls POST /api/glasses/code and shows a
 * 4-digit code on the lens. The rider types it here; glasses-web polls
 * GET /api/glasses/code/:code until it gets the same user token.
 *
 * Responsible for: a numeric 4-digit input (GlassesLinkReq regex ^\d{4}$) and
 * POST /api/glasses/link. On success, tell the rider to look at their lens and go Home.
 *
 * Uses: POST /api/glasses/link (GlassesLinkReq -> GlassesLinkRes).
 *
 * TODO:
 * - Friendlier errors for expired/unknown codes once the worker defines them.
 * - "Skip for now" copy explaining Ride Mode still works phone-only.
 * - Show "already linked" from GET /api/me.glassesLinked.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../lib/api";

export function LinkGlasses() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^\d{4}$/.test(code);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.linkGlasses(code);
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
        <h1>Glasses linked</h1>
        <p className="muted">Your lens should switch to the idle screen in a moment.</p>
        <Link className="btn primary" to="/">
          Done
        </Link>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Link your glasses</h1>
      <p className="muted">
        Open Questline on your glasses. Type the 4-digit code you see on the lens.
      </p>
      <input
        className="input code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        placeholder="0000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
      />
      <button className="btn primary" disabled={!valid || busy} onClick={() => void submit()}>
        {busy ? "Linking..." : "Link"}
      </button>
      {error && <p className="error">{error}</p>}
      <Link className="small" to="/">
        Skip for now
      </Link>
    </section>
  );
}
