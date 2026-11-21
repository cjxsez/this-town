/**
 * Offline.tsx (glasses-web): the rider socket dropped and is reconnecting.
 *
 * Shown by App while lib/socket.ts reports status "offline" (backoff retry in progress).
 * Select retries immediately (RiderSocket.retryNow). The glasses have no offline support,
 * so there is nothing useful to show beyond this.
 *
 * TODO:
 * - Show "last updated" age and the last known next stop.
 */
import { useInput } from "../lib/input";

interface OfflineProps {
  onRetry: () => void;
}

export function Offline({ onRetry }: OfflineProps) {
  useInput((action) => {
    if (action === "select") onRetry();
  });

  return (
    <main className="hud hud-center">
      <div className="hud-title">Reconnecting…</div>
      <div className="hud-body">Keep this open. Pinch to retry now.</div>
    </main>
  );
}
