/**
 * EndButtons.tsx (glasses-web): the buttons on a game's last screen.
 *
 * Played on its own a game ends with Restart. In the playlist at /g/ (Games.tsx) it ends
 * with "Next game", focused, and "Again" beside it: scroll moves between them, a tap picks.
 * Handles its own input, so the game's handler ignores the last screen.
 */
import { useState } from "react";
import { useInput } from "../lib/input";

export function EndButtons({ onAgain, onNext }: { onAgain: () => void; onNext?: () => void }) {
  const [focus, setFocus] = useState(0);

  useInput(
    (action) => {
      if (action === "select") {
        if (onNext && focus === 0) onNext();
        else onAgain();
      } else if (onNext && (action === "left" || action === "up")) setFocus(0);
      else if (onNext && (action === "right" || action === "down")) setFocus(1);
    },
    { pointer: true },
  );

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
    <div className="guess-row">
      {["Next game", "Again"].map((label, i) => (
        <div key={label} className={`hud-btn guess-btn ${focus === i ? "is-focused" : ""}`} role="button" aria-pressed={focus === i}>
          {label}
        </div>
      ))}
    </div>
  );
}
