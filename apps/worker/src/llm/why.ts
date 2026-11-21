/**
 * llm/why.ts: the one-line "why you two" blurb. The only place the LLM is used
 * (CLAUDE.md rules: missions never come from the LLM).
 *
 * Responsible for (architecture.md "Matching", step 6):
 * - `writeWhy()`: call the Claude Messages API for one short line grounded in the pair's
 *   shared interest tags, e.g. "You both love food and film". Hard 1.5 s timeout.
 * - `templateWhy()`: deterministic fallback when the key or model id is missing, the call
 *   fails, is slow, or returns something unusable.
 * - `sanitizeWhy()`: one line, no quotes, length-capped.
 *
 * The result goes in MatchFoundEvent.why (phone + glasses only). It is never sent to the
 * kiosk (public screen). TrainRoom caches it per pairKey in RoomState.whyCache and stores it
 * on the matches row.
 *
 * Protocol types: InterestTag, MatchFoundEvent.why.
 *
 * TODO:
 * - askMeAbout is user-written free text: it is passed as quoted data only, and the output
 *   is checked to stay a single short line. Consider dropping it entirely if outputs drift.
 */
import { interestLabel, type InterestTag } from "@questline/protocol";
import type { Env } from "../env";

/** Small, fast model for one line. Without ANTHROPIC_API_KEY the template line is used. */
export const WHY_MODEL = "claude-haiku-5-5";
export const WHY_TIMEOUT_MS = 1500;
export const WHY_MAX_CHARS = 90;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface WhyRider {
  firstName: string;
  askMeAbout: string;
}

export interface WhyInput {
  a: WhyRider;
  b: WhyRider;
  sharedTags: InterestTag[];
}

function label(tag: InterestTag): string {
  return interestLabel(tag);
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function templateWhy(sharedTags: InterestTag[]): string {
  if (sharedTags.length === 0) return "You're riding the same train";
  return `You both like ${joinList(sharedTags.slice(0, 3).map(label))}`;
}

export function sanitizeWhy(text: string | undefined): string | null {
  if (!text) return null;
  const line = text.split("\n")[0]?.trim().replace(/^["'“]+|["'”]+$/g, "") ?? "";
  if (line.length < 8 || line.length > WHY_MAX_CHARS) return null;
  return line;
}

export async function writeWhy(env: Env, input: WhyInput): Promise<string> {
  const fallback = templateWhy(input.sharedTags);
  if (!env.ANTHROPIC_API_KEY || WHY_MODEL.startsWith("TODO") || input.sharedTags.length === 0) return fallback;

  const system =
    "You write one short, warm line (under 80 characters) telling two strangers on a train why they were matched. " +
    "Address them together as \"You both\". Ground it only in the shared interests given. " +
    "No names, no emojis, no quotes, no questions. Output the line only.";
  const user = JSON.stringify({
    sharedInterests: input.sharedTags.map(label),
    askMeAbout: [input.a.askMeAbout, input.b.askMeAbout].filter(Boolean),
  });

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: AbortSignal.timeout(WHY_TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: WHY_MODEL,
        max_tokens: 60,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return sanitizeWhy(data.content?.find((b) => b.type === "text")?.text) ?? fallback;
  } catch {
    return fallback;
  }
}
