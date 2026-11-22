/**
 * preview.ts (kiosk-web): sample screens for design checks, no socket, no key.
 *
 *   /kiosk/1412?preview=idle | pair | mission | celebrate | rare | offline
 *   /kiosk/1412?preview=all      cycles through them every 6 s
 *
 * Sample names only; nothing here comes from the server.
 */
import type { Mission, PairColor } from "@questline/protocol";
import type { IdleStats } from "../screens/Idle";

export const PREVIEW_SCREENS = ["idle", "pair", "mission", "celebrate", "rare", "offline"] as const;
export type PreviewScreen = (typeof PREVIEW_SCREENS)[number];
export type PreviewMode = PreviewScreen | "all";

export function readPreview(loc: Location = window.location): PreviewMode | null {
  const p = new URLSearchParams(loc.search).get("preview");
  if (p === null) return null;
  if (p === "" || p === "all") return "all";
  return (PREVIEW_SCREENS as readonly string[]).includes(p) ? (p as PreviewScreen) : "all";
}

export const SAMPLE = {
  color: "orange" as PairColor,
  firstNames: ["Maya", "Andres"] as [string, string],
  stats: { ridersInCar: 3, ridersOnTrain: 12, nextStop: "Park Street", nextStopEtaSec: 142 } satisfies IdleStats,
  mission(now: number): Mission {
    return {
      sessionId: "preview",
      templateId: "preview",
      category: "create",
      title: "Name this train",
      prompt: "Give this train a band name and a one-line hit song. Say it out loud together.",
      endsAt: now + 90_000,
      rare: false,
    };
  },
};
