import { createHttpApi } from "./http";
import { createMockApi } from "./mock";
import type { RideSim } from "./mock/rideSim";

const mode = import.meta.env.VITE_API_MODE ?? "mock";
const mock = mode === "mock" ? createMockApi() : undefined;

export const api = mock ?? createHttpApi();

/** Demo controls exist only in mock mode. */
export const sim: RideSim | undefined = mock?.ride;

export type { QuestlineApi, RideChannel } from "./types";
