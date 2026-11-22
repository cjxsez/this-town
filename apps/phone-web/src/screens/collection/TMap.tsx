import { useMemo } from "react";
import { renderMap } from "@questline/t-map";
import type { Stamp } from "../../../shared/types";

/**
 * The whole T at passport-card size: every line and station, no names, stamped stations
 * in yellow. The full map, with names and zoom, is H7 (/passport/map).
 */
export function TMap({ stamps }: { stamps: Stamp[] }) {
  const ids = [...new Set(stamps.map((s) => s.stationId))].sort();
  const key = ids.join();
  const svg = useMemo(() => renderMap({ labels: false, stamped: ids }), [key]);
  return <div className="cl-map__svg" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}
