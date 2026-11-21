/**
 * Countdown.tsx (kiosk-web): big m:ss countdown to an absolute epoch-ms time.
 *
 * Used by Mission (Mission.endsAt from mission.show) and Idle (next stop, converted from
 * kiosk.idle nextStopEtaSec at receipt time). No API or socket use.
 *
 * TODO:
 * - Clock skew: Mission.endsAt is server epoch ms; the Pi clock should be NTP-synced,
 *   but correct with a server time offset once the protocol carries one.
 * - Last-10-seconds urgency style.
 */
import { useEffect, useState } from "react";

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface CountdownProps {
  endsAt: number;
  className?: string;
}

export function Countdown({ endsAt, className }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remaining = endsAt - now;
  const urgent = remaining > 0 && remaining <= 10_000;

  return (
    <span className={`countdown ${urgent ? "is-urgent" : ""} ${className ?? ""}`} role="timer">
      {formatRemaining(remaining)}
    </span>
  );
}
