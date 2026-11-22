import { LINE_STATION_COUNT, stationById } from "../../shared/catalog";
import type { GreenBranch, LineColor, Stamp } from "../../shared/types";

/** Stops per Green Line branch, trunk included (Gov't Ctr out to the end of the branch). */
const BRANCH_STOPS: Record<GreenBranch, number> = { B: 23, C: 19, D: 19, E: 18 };

/** Distinct stations stamped on this line (and branch, for the Green Line), out of how many. */
export function lineProgress(stamps: Stamp[], line: LineColor, branch?: GreenBranch) {
  const ids = new Set(
    stamps
      .filter((s) => s.line === line)
      .filter((s) => {
        if (line !== "green" || !branch) return true;
        const st = stationById(s.stationId);
        return !st?.branches || st.branches.includes(branch);
      })
      .map((s) => s.stationId),
  );
  const total = line === "green" && branch ? BRANCH_STOPS[branch] : LINE_STATION_COUNT[line];
  return { got: ids.size, total };
}
