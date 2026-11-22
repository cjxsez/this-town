/**
 * Games.tsx (glasses-web): the playlist at the /g/ root. The games run one after another:
 * Guess who, then Trail trivia, then Split clue, then back to the first. Each game's last
 * screen offers "Next game" or "Again" (EndButtons).
 */
import { useState } from "react";
import { GuessGame } from "./screens/GuessGame";
import { HikeGame } from "./screens/HikeGame";

const COUNT = 3;

export function Games() {
  const [game, setGame] = useState(0);
  const next = () => setGame((g) => (g + 1) % COUNT);

  if (game === 0) return <GuessGame key="guess" onNext={next} />;
  if (game === 1) return <HikeGame key="hike" onNext={next} />;
  return <HikeGame key="split" split onNext={next} />;
}
