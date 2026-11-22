import type { GameProps, StubView } from "@questline/protocol/games";
import { StubGame } from "../StubGame";

/** "Left for you" on the phone. Placeholder until the game is written. */
export function TriviaGame(props: GameProps<StubView>) {
  return <StubGame title="Left for you" {...props} />;
}
