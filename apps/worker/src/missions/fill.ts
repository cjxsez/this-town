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

const LINE_NAME: Record<string, string> = {
  Red: "Red",
  Orange: "Orange",
  Blue: "Blue",
  "Green-B": "Green",
  "Green-C": "Green",
  "Green-D": "Green",
  "Green-E": "Green",
};

export function slotValuesFor(state: RoomState, color: PairColor): SlotValues {
  const name = (i: number | null) => (i === null || i < 0 ? null : (state.stops[i]?.name ?? null));
  const station = name(state.nextStopIdx) ?? name(state.currentStopIdx) ?? "this station";
  return {
    station,
    lastStation: name(state.currentStopIdx) ?? station,
    line: state.trip ? (LINE_NAME[state.trip.line] ?? state.trip.line) : "T",
    terminus: name(state.stops.length - 1) ?? station,
    color,
  };
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
