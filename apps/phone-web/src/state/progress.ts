import { BRANCH_STOP_COUNT, LINE_STATION_COUNT, stationById } from "../../shared/catalog";
import type { GreenBranch, LineColor, Stamp } from "../../shared/types";


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
  const total = line === "green" && branch ? BRANCH_STOP_COUNT[branch] : LINE_STATION_COUNT[line];
  return { got: ids.size, total };
}
