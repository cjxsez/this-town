/**
 * Screen Wake Lock for the ride HUD. Keeps the page awake for the whole ride when the
 * glasses browser supports it. Feature-detects; no-ops when missing.
 */
import { useEffect } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };

export async function requestWakeLock(): Promise<WakeLockSentinelLike | null> {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
  };
  if (!nav.wakeLock?.request) return null;
  try {
    return await nav.wakeLock.request("screen");
  } catch (err) {
    console.warn("[wakeLock] request failed", err);
    return null;
  }
}

/** Request a screen wake lock while `active` is true; re-request on visibility visible. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.hidden) return;
      await sentinel?.release().catch(() => {});
      sentinel = await requestWakeLock();
    };

    void acquire();
    const onVis = () => {
      if (!document.hidden) void acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
