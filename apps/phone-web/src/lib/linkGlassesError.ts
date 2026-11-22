import { ApiError } from "./api";

const EXPIRED =
  "That code expired or doesn't match. Check the 4 digits on your glasses, or reopen In This Town on them for a new one";
const OFFLINE = "No signal. Try again in a moment";
const GENERIC = "Couldn't link those glasses. Try again in a moment.";

/**
 * Map link-glasses failures to plain rider copy. Never surface raw worker strings
 * like "unauthorized".
 */
export function linkGlassesErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 404 || e.status === 410) return EXPIRED;
    if (e.status === 0 || e.code === "timeout" || e.code === "offline") return OFFLINE;
    return GENERIC;
  }
  if (e instanceof TypeError) return OFFLINE;
  return GENERIC;
}
