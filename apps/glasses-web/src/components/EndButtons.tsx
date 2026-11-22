/**
 * EndButtons.tsx (glasses-web): the buttons on a game's last screen.
 *
 * Played on its own a game ends with Restart. In the playlist at /g/ (Games.tsx) it ends
 * with "Next game", focused, and "Again" beside it: scroll moves between them, a tap picks.
 * The last game of the playlist ends with one Finish button (`last`), which calls onNext.
 * These are votes (`votes`): the room only moves once both players picked the same, so the
 * picked button shows a tick and a line says who you are waiting for.
 * Handles its own input, so the game's handler ignores the last screen.
 */
import { useState } from "react";
import type { EndChoice, EndVotes } from "@questline/protocol/games";
import { useInput } from "../lib/input";

const LABEL: Record<EndChoice, string> = { next: "Next game", again: "Again", finish: "Finish" };

/** The line under the buttons: who is waiting for whom. */
function voteLine(votes: EndVotes | undefined): string | null {
  if (!votes) return null;
  const { you, partner } = votes;
  if (you && partner && you !== partner) return `Your partner picked ${LABEL[partner]}`;
  if (you) return "Waiting for your partner";
  if (partner) return `Your partner picked ${LABEL[partner]}`;
  return "You both pick to go on";
}

export function EndButtons({
  onAgain,
  onNext,
  last,
  votes,
}: {
  onAgain: () => void;
  onNext?: () => void;
  last?: boolean;
  votes?: EndVotes;
}) {
  const [focus, setFocus] = useState(0);

  useInput(
    (action) => {
      if (action === "select") {
        if (onNext && (last || focus === 0)) onNext();
        else onAgain();
      } else if (last) {
        // one button: nothing to move between
      } else if (onNext && (action === "left" || action === "up")) setFocus(0);
      else if (onNext && (action === "right" || action === "down")) setFocus(1);
    },
    { pointer: true },
  );

  const mine = votes?.you ?? null;
  const line = voteLine(votes);
  const hint = line ? <div className="guess-hint">{line}</div> : null;

  if (onNext && last) {
    return (
      <>
        <div className="guess-row">
          <div className="hud-btn guess-btn is-focused" role="button" aria-pressed={mine === "finish"}>
            {mine === "finish" ? "✓ Finish" : "Finish"}
          </div>
        </div>
        {hint}
      </>
    );
  }
  if (!onNext) {
    return (
      <div className="guess-row">
        <div className="hud-btn guess-btn is-focused" role="button">
          Restart
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="guess-row">
        {(["next", "again"] as const).map((choice, i) => (
          <div key={choice} className={`hud-btn guess-btn ${focus === i ? "is-focused" : ""}`} role="button" aria-pressed={mine === choice}>
            {mine === choice ? `✓ ${LABEL[choice]}` : LABEL[choice]}
          </div>
        ))}
      </div>
      {hint}
    </>
  );
}
