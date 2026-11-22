import type { QuestlineApi } from "../types";
import { RideSim } from "./rideSim";

const ok = () => Promise.resolve();

/** In-browser stand-in for the backend. Collections live in the app store. */
export function createMockApi(): QuestlineApi & { ride: RideSim } {
  return {
    saveProfile: ok,
    deleteMyData: ok,
    // Any 4 digits link in mock mode, so the onboarding step can be clicked through.
    linkGlasses: async (code) => {
      if (!/^\d{4}$/.test(code)) throw new Error("Enter the 4 digits on your glasses.");
    },
    loadPassport: async () => null,
    loadPeople: async () => null,
    report: ok,
    block: ok,
    unblock: ok,
    ride: new RideSim(),
  };
}
