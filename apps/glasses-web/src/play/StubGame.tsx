/** StubGame.tsx (glasses-web): the screen for a placeholder game (protocol games/stub.ts). */
import type { GameProps, StubView } from "@questline/protocol/games";
import { EndButtons } from "../components/EndButtons";
import { Wobble } from "../components/Wobble";
import { useInput } from "../lib/input";

export function StubGame({ title, view, send, onNext, onAgain, last }: GameProps<StubView> & { title: string }) {
  useInput(
    (action) => {
      if (view.phase === "intro" && action === "select") send({ type: "ready" });
    },
    { pointer: true },
  );

  if (view.phase === "done") {
    return (
      <main className="hud hud-center guess">
        <Wobble />
        <div className="guess-title guess-title-sm">{title}</div>
        <div className="guess-hint">Not built yet</div>
        <EndButtons onAgain={onAgain} onNext={onNext} last={last} />
      </main>
    );
  }
  return (
    <main className="hud hud-center guess guess-start">
      <Wobble />
      <div className="guess-title">{title}</div>
      <div className="guess-hint">{view.youReady ? "Waiting for your partner" : "Tap to start"}</div>
      <div className="guess-row">
        <div className={`hud-btn guess-btn ${view.youReady ? "" : "is-focused"}`} role="button">
          {view.youReady ? "Ready" : "Start"}
        </div>
      </div>
    </main>
  );
}
