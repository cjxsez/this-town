import type { QuestlineApi } from "../types";
import { RideSim } from "./rideSim";

const ok = () => Promise.resolve();

/** In-browser stand-in for the backend. State lives in the app store. */
export function createMockApi(): QuestlineApi & { ride: RideSim } {
  return {
    saveProfile: ok,
    deleteMyData: ok,
    // "Waiting" until the other person turns it on too; the mock never tells you.
    setStayInTouch: async (_id, on) => (on ? "waiting" : "off"),
    report: ok,
    block: ok,
    unblock: ok,
    voteMemory: ok,
    ride: new RideSim(),
  };
}
