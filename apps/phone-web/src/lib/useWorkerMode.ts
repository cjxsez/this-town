import { useEffect, useState } from "react";
import { loadWorkerMode } from "./workerMode";

/** gamesOnly from GET /api/health (cached). false until loaded or on failure / mock. */
export function useGamesOnly(): boolean {
  const [gamesOnly, setGamesOnly] = useState(false);
  useEffect(() => {
    void loadWorkerMode().then((m) => setGamesOnly(m.gamesOnly));
  }, []);
  return gamesOnly;
}
