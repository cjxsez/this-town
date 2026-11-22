/** TaleGame.tsx (glasses-web): "Tall tale" on the lens. Placeholder until the game is written. */
import type { GameProps, StubView } from "@questline/protocol/games";
import { StubGame } from "../StubGame";

export function TaleGame(props: GameProps<StubView>) {
  return <StubGame title="Tall tale" {...props} />;
}
