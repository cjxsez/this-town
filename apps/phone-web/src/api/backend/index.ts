import { api as rest } from "../../lib/api";
import { getToken } from "../../lib/auth";
import type { QuestlineApi } from "../types";
import { REPORT_REASON, toPerson, toStamp } from "./map";
import { BackendRide } from "./ride";

/** The real worker (apps/worker) behind the same seam the simulator fills in mock mode. */
export function createBackendApi(): Omit<QuestlineApi, "ride"> & { ride: BackendRide } {
  const ride = new BackendRide();
  return {
    ride,
    saveProfile: (p) => ride.saveProfile(p).catch((e) => console.warn("[questline] could not save the profile", e)),
    deleteMyData: async () => {
      if (getToken()) await rest.deleteMe();
      ride.signOut();
    },
    linkGlasses: async (code) => {
      await rest.linkGlasses(code);
    },
    loadPassport: async () => {
      if (!getToken()) return null;
      const p = await rest.getPassport();
      return p.stamps.map((s) => toStamp(s, {}));
    },
    loadPeople: async () => {
      if (!getToken()) return null;
      const r = await rest.getRecentMatches();
      return r.matches.map(toPerson);
    },
    // People are keyed by the match they were met in, which is what the worker reports against.
    report: async (personId, reason, alsoBlock) => {
      if (getToken()) await rest.report({ matchId: personId, reason: REPORT_REASON[reason], block: alsoBlock });
    },
    // The worker blocks as part of a report.
    block: async (personId) => {
      if (getToken()) await rest.report({ matchId: personId, reason: "Blocked from People", block: true });
    },
    // No unblock route yet: it only changes this device.
    unblock: async () => {},
  };
}

export { BackendRide };
