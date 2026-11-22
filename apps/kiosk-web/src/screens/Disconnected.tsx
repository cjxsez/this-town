/**
 * Disconnected.tsx (kiosk-web): socket down, or the URL is missing car/key.
 *
 * Shown while lib/socket.ts reports "offline" (it keeps retrying), or when
 * lib/config.ts could not read /kiosk/:car and ?key=. Shows the car id so whoever is
 * fixing it knows which kiosk this is. Uses the phone's Night sea. Bad-key closes use
 * WS_CLOSE.badAuth / forbidden on the socket; the screen just keeps reconnecting.
 */
import { Screen, Wordmark } from "../components/Ui";

interface DisconnectedProps {
  car: string | null;
  /** Config error; when absent we are connecting or reconnecting. */
  error?: string;
  /** First connect vs drop — changes the title only. */
  connecting?: boolean;
}

export function Disconnected({ car, error, connecting }: DisconnectedProps) {
  const title = error ? "Kiosk not set up" : connecting ? "Connecting" : "Reconnecting";
  return (
    <Screen label="Kiosk offline" blobs="a" className="k-screen--night k-offline">
      <Wordmark size={26} style={{ marginBottom: 8 }} />
      <section className="k-card" aria-live="polite">
        <h1 className="k-title">{title}</h1>
        {error ? (
          <p className="k-hint">{error}</p>
        ) : (
          <>
            <span className="k-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <p className="k-hint">
              {connecting ? "Linking to this train…" : "Back in a moment. You can still tap the tag."}
            </p>
          </>
        )}
      </section>
      <span className="k-pill" style={{ marginTop: 8 }}>{car ? `Car ${car}` : "No car"}</span>
    </Screen>
  );
}
