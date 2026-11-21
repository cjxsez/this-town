/**
 * matching/colors.ts: pair colors.
 *
 * Responsible for:
 * - Assigning each new pair a PairColor that no other active pair on this train is using,
 *   so two pairs walking through the same cars never chase the same glow. The kiosk LEDs,
 *   kiosk screen and glasses all use the same names (protocol PAIR_COLOR_HEX).
 * - Returning null when all six colors are taken; TrainRoom then holds the pair until a
 *   color frees up.
 *
 * Protocol types: PairColor, PAIR_COLOR_HEX (clients map name -> hex).
 *
 * TODO:
 * - docs/demo-script.md step 6 says the rare late-bonus mission "unlocks in purple". If
 *   purple is meant to signal rare missions, drop it from COLOR_ORDER so no pair is purple
 *   by default. Decide with the kiosk-web / kiosk-pi owners.
 */
import { PairColor } from "@questline/protocol";
import type { RoomState } from "../rooms/state";

/** Preference order: orange first (the demo pair is orange). */
export const COLOR_ORDER: readonly PairColor[] = PairColor.options;

export function colorsInUse(state: RoomState): PairColor[] {
  return Object.values(state.pairs).map((p) => p.color);
}

export function assignColor(inUse: Iterable<PairColor>): PairColor | null {
  const used = new Set(inUse);
  return COLOR_ORDER.find((c) => !used.has(c)) ?? null;
}
