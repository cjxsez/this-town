/**
 * Countdown.tsx: m:ss countdown to an epoch-ms deadline.
 *
 * Responsible for: ticking once a second toward `endsAt` and clamping at 0:00. Used for
 * mission time left (Mission.endsAt) and time to next stop (stateAt + nextStopEtaSec).
 *
 * Uses: no routes or events itself.
 *
 * TODO:
 * - Apply a server clock offset if phone clocks drift (see useRide.ts).
 * - onDone callback if a screen needs to react at 0:00.
 */
import { useEffect, useState } from "react";

interface Props {
  /** Epoch ms. */
  endsAt: number;
  label?: string;
}

export function Countdown({ endsAt, label }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");

  return (
    <span className="countdown">
      {label ? `${label} ` : ""}
      {m}:{s}
    </span>
  );
}
