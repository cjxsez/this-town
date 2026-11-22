/**
 * Worker mode from GET /api/health ({ gamesOnly, demoMode }). Fetched once and cached.
 * On failure, treat as mission mode so existing copy stays honest by default.
 */
export interface WorkerMode {
  gamesOnly: boolean;
  demoMode: boolean;
}

const FALLBACK: WorkerMode = { gamesOnly: false, demoMode: false };

let cached: WorkerMode | null = null;
let inflight: Promise<WorkerMode> | null = null;

export function resetWorkerModeForTests(): void {
  cached = null;
  inflight = null;
}

export async function loadWorkerMode(): Promise<WorkerMode> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) return FALLBACK;
      const json = (await res.json()) as { gamesOnly?: unknown; demoMode?: unknown };
      cached = {
        gamesOnly: json.gamesOnly === true,
        demoMode: json.demoMode === true,
      };
      return cached;
    } catch {
      return FALLBACK;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
