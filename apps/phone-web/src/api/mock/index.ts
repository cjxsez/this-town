import type { QuestlineApi } from "../types";
import { RideSim } from "./rideSim";

const ok = () => Promise.resolve();
const MOCK_CODE = "123456";

/** In-browser stand-in for the backend. Collections live in the app store. */
export function createMockApi(): QuestlineApi & { ride: RideSim } {
  const ride = new RideSim();
  return {
    // The simulator has no accounts: every email is new, and the code is always 123456.
    auth: {
      sendCode: async (email) => console.info(`[questline mock] sign-in code for ${email}: ${MOCK_CODE}`),
      verifyCode: async (email, code) => {
        if (code !== MOCK_CODE) throw new Error(`That code isn't right. In the simulator it's ${MOCK_CODE}.`);
        return { status: "new-account", email };
      },
      attachEmail: async (_email, code) => {
        if (code !== MOCK_CODE) throw new Error(`That code isn't right. In the simulator it's ${MOCK_CODE}.`);
      },
    },
    saveProfile: ok,
    deleteMyData: ok,
    signOut: async () => ride.checkOut(),
    // Any 4 digits link in mock mode, so the onboarding step can be clicked through.
    linkGlasses: async (code) => {
      if (!/^\d{4}$/.test(code)) throw new Error("Enter the 4 digits on your glasses.");
    },
    loadPassport: async () => null,
    loadPeople: async () => null,
    report: ok,
    block: ok,
    unblock: ok,
    ride,
  };
}
