import type { QuestlineApi } from "../types";
import { RideSim } from "./rideSim";

const ok = () => Promise.resolve();
const MOCK_CODE = "123456";

/** In-browser stand-in for the backend. State lives in the app store. */
export function createMockApi(): QuestlineApi & { ride: RideSim } {
  return {
    // The simulator has no accounts: every email is new, and the code is always 123456.
    auth: {
      sendCode: async (email) => console.info(`[questline mock] sign-in code for ${email}: ${MOCK_CODE}`),
      verifyCode: async (email, code) => {
        if (code !== MOCK_CODE) throw new Error(`That code isn't right. In the simulator it's ${MOCK_CODE}.`);
        return { status: "new-account", email };
      },
    },
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
