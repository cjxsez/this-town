/**
 * games/index.ts: the games played between a pair of glasses and a phone, in playlist
 * order. Imported as "@questline/protocol/games" by the worker (which runs the modules)
 * and by glasses-web and phone-web (which draw the views).
 */
import { impressionsGame } from "./impressions";
import { taleGame } from "./tale";
import { triviaGame } from "./trivia";
import type { GameId, GameModule } from "./types";

export * from "./types";
export * from "./client";
export * from "./stub";
export * from "./tale";
export * from "./impressions";
export * from "./trivia";

/** Playlist order: after the last game, "Next game" goes back to the first. */
export const GAMES: GameModule<any, any>[] = [taleGame, impressionsGame, triviaGame];

export function gameById(id: GameId): GameModule<unknown, unknown> {
  const found = GAMES.find((g) => g.id === id);
  if (!found) throw new Error(`unknown game ${id}`);
  return found;
}
