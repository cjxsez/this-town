/**
 * Disconnected.tsx (kiosk-web): socket down, or the URL is missing car/key.
 *
 * Shown while lib/socket.ts reports "offline" (it keeps retrying), or when
 * lib/config.ts could not read /kiosk/:car and ?key=. Shows the car id small so whoever
 * is fixing it knows which kiosk this is.
 *
 * TODO:
 * - Distinguish "bad key" once the worker uses a close code for it.
 * - Hide the error detail behind a long-press for the demo.
 */

interface DisconnectedProps {
  car: string | null;
  /** Config error; when absent we are just reconnecting. */
  error?: string;
}

export function Disconnected({ car, error }: DisconnectedProps) {
  return (
    <main className="screen disconnected">
      <div className="disc-title">{error ? "Kiosk not set up" : "Reconnecting…"}</div>
      <div className="disc-sub">{error ?? "In This Town will be back in a moment"}</div>
      <footer className="screen-foot">{car ? `car ${car}` : "no car"}</footer>
    </main>
  );
}
