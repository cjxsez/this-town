/**
 * Countdown.tsx (glasses-web): m:ss countdown to an absolute epoch-ms time.
 *
 * Used by Idle (next stop ETA, converted from RideState.nextStopEtaSec at receipt time)
 * and Mission (Mission.endsAt from mission.start). No API or socket use.
 *
 * TODO:
 * - Clock skew: Mission.endsAt is server epoch ms and the glasses clock may differ.
 *   Correct with a server time offset once the protocol carries one.
 * - Pulse / turn red in the last 10 s (keep it bright: dim colors vanish on the waveguide).
 */
import { useEffect, useRef, useState } from "react";

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface CountdownProps {
  endsAt: number;
  onDone?: () => void;
  className?: string;
}

export function Countdown({ endsAt, onDone, className }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const doneRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    doneRef.current = false;
  }, [endsAt]);

  const remaining = endsAt - now;

  useEffect(() => {
    if (remaining <= 0 && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [remaining, onDone]);

  return (
    <span className={`countdown ${className ?? ""}`} role="timer">
      {formatRemaining(remaining)}
    </span>
  );
}
