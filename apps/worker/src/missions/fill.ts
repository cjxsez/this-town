/**
 * missions/fill.ts: slot filling for mission templates.
 *
 * Responsible for:
 * - `slotValuesFor()`: compute {station}, {lastStation}, {line}, {terminus}, {color} from the
 *   room's current stops and the pair's color.
 * - `fillTemplate()`: replace {slot}s in title + prompt. Unknown slots are left as-is so a
 *   typo is visible in testing rather than silently blank.
 * - `toMission()`: build the protocol Mission sent in mission.start (riders) and mission.show
 *   (kiosk), with endsAt = next stop ETA minus 30 s.
 *
 * Protocol types: Mission, PairColor.
 *
 * TODO:
 * - slotValuesFor(): pick names from state.stops using currentStopIdx / nextStopIdx; fall
 *   back to "the next stop" / "here" when unknown.
 */
import type { Mission, PairColor } from "@questline/protocol";
import type { RoomState } from "../rooms/state";
import type { MissionTemplate, SlotName } from "./deck";

export type SlotValues = Record<SlotName, string>;

export function fillText(text: string, values: SlotValues): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name as SlotName] : match,
  );
}

export function fillTemplate(t: MissionTemplate, values: SlotValues): { title: string; prompt: string } {
  return { title: fillText(t.title, values), prompt: fillText(t.prompt, values) };
}

export function slotValuesFor(state: RoomState, color: PairColor): SlotValues {
  throw new Error("TODO: station / lastStation / line / terminus from state, color from pair");
}

export function toMission(
  t: MissionTemplate,
  values: SlotValues,
  sessionId: string,
  endsAt: number,
): Mission {
  const { title, prompt } = fillTemplate(t, values);
  return { sessionId, templateId: t.id, category: t.category, title, prompt, endsAt, rare: t.rare };
}
