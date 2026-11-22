/**
 * Countdown.tsx (kiosk-web): m:ss countdown to an absolute epoch-ms time.
 *
 * Used by Mission (Mission.endsAt from mission.show) and Idle (next stop, converted from
 * kiosk.idle nextStopEtaSec at receipt time). Uses lib/clock.ts so endsAt stays aligned
 * with the worker.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { serverNowMs } from "../lib/clock";

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Milliseconds left until endsAt, ticking 4x a second. */
export function useRemaining(endsAt: number): number {
  const [now, setNow] = useState(() => serverNowMs());
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNowMs()), 250);
    return () => window.clearInterval(id);
  }, []);
  return endsAt - now;
}

interface CountdownProps {
  endsAt: number;
  className?: string;
  style?: CSSProperties;
}

export function Countdown({ endsAt, className, style }: CountdownProps) {
  const remaining = useRemaining(endsAt);
  const urgent = remaining > 0 && remaining <= 10_000;
  return (
    <span className={`k-countdown ${urgent ? "is-urgent" : ""} ${className ?? ""}`} style={style} role="timer">
      {formatRemaining(remaining)}
    </span>
  );
}

/** A bar that drains from startedAt to endsAt. */
export function Drain({ startedAt, endsAt }: { startedAt: number; endsAt: number }) {
  const remaining = useRemaining(endsAt);
  const total = Math.max(1, endsAt - startedAt);
  const left = Math.min(1, Math.max(0, remaining / total));
  return (
    <div className="k-drain" aria-hidden>
      <div className="k-drain__fill" style={{ transform: `scaleX(${left})` }} />
    </div>
  );
}
