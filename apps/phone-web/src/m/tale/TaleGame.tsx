import type { GameProps, StubView } from "@questline/protocol/games";
import { StubGame } from "../StubGame";

/** "Tall tale" on the phone. Placeholder until the game is written. */
export function TaleGame(props: GameProps<StubView>) {
  return <StubGame title="Tall tale" {...props} />;
}
