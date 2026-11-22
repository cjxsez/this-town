/**
 * LinkCode.tsx (glasses-web): shown when there is no token in localStorage.
 *
 * Shows a big 4-digit code. The rider types it on the phone (phone-web calls
 * POST /api/glasses/link). Meanwhile lib/link.ts runs:
 *   POST /api/glasses/code, then polls GET /api/glasses/code/:code until linked.
 * On link, the token is saved and onLinked(token) moves App to Idle.
 *
 * Input: select = retry after an error.
 *
 * TODO:
 * - Show time left on the code (expiresAt) and fade it before it rotates.
 * - Short "Linked!" confirmation before switching to Idle.
 */
import { useEffect, useRef, useState } from "react";
import { useInput } from "../lib/input";
import { startLinking } from "../lib/link";

interface LinkCodeProps {
  onLinked: (token: string) => void;
}

export function LinkCode({ onLinked }: LinkCodeProps) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onLinkedRef = useRef(onLinked);

  useEffect(() => {
    onLinkedRef.current = onLinked;
  });

  useEffect(() => {
    setCode(null);
    setError(null);
    return startLinking({
      onCode: (c) => {
        setCode(c);
        setError(null);
      },
      onLinked: (token) => onLinkedRef.current(token),
      onError: (msg) => setError(msg),
    });
  }, [attempt]);

  useInput((action) => {
    if (action === "select" && error) setAttempt((n) => n + 1);
  });

  return (
    <main className="hud hud-center">
      <div className="hud-dim">Link your glasses</div>
      <div className="hud-code" aria-live="polite">
        {code ?? "····"}
      </div>
      <div className="hud-body">Enter this code in In This Town on your phone</div>
      {error && <div className="hud-warn">Can't reach In This Town. Pinch to retry.</div>}
    </main>
  );
}
