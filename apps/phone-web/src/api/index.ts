import { createBackendApi } from "./backend";
import { createMockApi } from "./mock";
import type { RideSim } from "./mock/rideSim";
import type { QuestlineApi } from "./types";

// Dev runs against the in-browser simulator unless told otherwise; a production build
// talks to the worker it is served from.
const mode = import.meta.env.VITE_API_MODE ?? (import.meta.env.PROD ? "http" : "mock");
const mock = mode === "mock" ? createMockApi() : undefined;

/** The worker-backed API; undefined in mock mode. */
export const backend = mock ? undefined : createBackendApi();

export const api: QuestlineApi = mock ?? backend!;

/** Demo controls exist only in mock mode. */
export const sim: RideSim | undefined = mock?.ride;

export type { QuestlineApi, RideChannel } from "./types";
