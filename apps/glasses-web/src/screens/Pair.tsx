/**
 * Pair.tsx (glasses-web): shown at /g/ until a phone joins the room, and again whenever
 * the phone drops out. The glasses cannot type, so they show the code and the phone enters it:
 * either a partner joining at /m, or a player already in a game there moving it onto this lens.
 */
import { Wobble } from "../components/Wobble";

export function Pair({ code, state }: { code: string | null; state: "opening" | "waiting" | "away" | "error" }) {
  const address = `${location.host}/m`;
  return (
    <main className="hud hud-center guess">
      <Wobble />
      {state === "away" ? (
        <div className="guess-title guess-title-sm">Partner dropped out</div>
      ) : (
        <div className="guess-eyebrow">Play with a phone</div>
      )}
      {code ? (
        <>
          <div className="pair-code" aria-label={`Code ${code.split("").join(" ")}`}>
            {code}
          </div>
          <div className="guess-body">
            On a phone, open <span className="pair-url">{address}</span> and enter this code
          </div>
          {state === "waiting" && <div className="guess-hint">Already playing on your phone? Tap Play on glasses there.</div>}
        </>
      ) : (
        <div className="guess-body">{state === "error" ? "Can't reach Questline. Trying again…" : "Getting a code…"}</div>
      )}
    </main>
  );
}
