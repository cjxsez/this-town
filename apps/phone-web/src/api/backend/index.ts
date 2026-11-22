import { api as rest } from "../../lib/api";
import { getToken, setSignupTicket, setToken } from "../../lib/auth";
import type { QuestlineApi } from "../types";
import { fromWireProfile, REPORT_REASON } from "./map";
import { BackendRide } from "./ride";

const noRoute = (what: string) => {
  if (import.meta.env.DEV) console.info(`[questline] ${what}: the worker has no route for this yet`);
};

/** The real worker (apps/worker) behind the same seam the simulator fills in mock mode. */
export function createBackendApi(): Omit<QuestlineApi, "ride"> & { ride: BackendRide } {
  const ride = new BackendRide();
  return {
    ride,
    auth: {
      sendCode: async (email) => {
        await rest.authStart(email);
      },
      verifyCode: async (email, code) => {
        const res = await rest.authVerify(email, code);
        if (res.status === "signed-in") {
          ride.signOut(); // drop any guest token and ride state on this device first
          setSignupTicket(null);
          setToken(res.token);
          return { status: "signed-in", profile: fromWireProfile(res.profile, res) };
        }
        setSignupTicket(res.signupTicket);
        return { status: "new-account", email: res.email };
      },
    },
    // Runs after onboarding and on every profile edit; only the first one reaches the worker.
    saveProfile: (p) => ride.ensureUser(p).catch((e) => console.warn("[questline] could not create the rider", e)),
    // No delete route yet: forget the token so this device is a stranger again.
    deleteMyData: async () => {
      noRoute("deleting the rider");
      ride.signOut();
    },
    setStayInTouch: async (_id, on) => {
      noRoute("stay in touch");
      return on ? "waiting" : "off";
    },
    // People are keyed by the match they were met in, which is what the worker reports against.
    report: async (personId, reason, alsoBlock) => {
      if (getToken()) await rest.report({ matchId: personId, reason: REPORT_REASON[reason], block: alsoBlock });
    },
    // Blocking only exists as part of a report on the worker; a bare block stays on this device.
    block: async () => noRoute("blocking without a report"),
    unblock: async () => noRoute("unblocking"),
    voteMemory: async () => noRoute("photo memories"),
  };
}

export { BackendRide };
