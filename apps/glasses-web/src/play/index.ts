/** play/index.ts (glasses-web): the lens screen for each game id. */
import type { ComponentType } from "react";
import type { GameId, GameProps } from "@questline/protocol/games";
import { ImpressionsGame } from "./impressions/ImpressionsGame";
import { TaleGame } from "./tale/TaleGame";
import { TriviaGame } from "./trivia/TriviaGame";

// Each screen takes its own game's view type; the room hands views over untyped, and the
// id picks the matching screen.
export const SCREENS = {
  tale: TaleGame,
  impressions: ImpressionsGame,
  trivia: TriviaGame,
} as unknown as Record<GameId, ComponentType<GameProps<unknown>>>;
