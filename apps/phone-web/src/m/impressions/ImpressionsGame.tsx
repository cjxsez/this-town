import type { GameProps, StubView } from "@questline/protocol/games";
import { StubGame } from "../StubGame";

/** "First impressions" on the phone. Placeholder until the game is written. */
export function ImpressionsGame(props: GameProps<StubView>) {
  return <StubGame title="First impressions" {...props} />;
}
