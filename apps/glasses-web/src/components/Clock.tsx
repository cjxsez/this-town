/** Clock.tsx (glasses-web): the outlined m:ss pill for a game deadline given in server time. */
import { useSecondsLeft } from "../lib/room";

export function Clock({ deadline, serverNow }: { deadline: number; serverNow: () => number }) {
  const left = useSecondsLeft(deadline, serverNow) ?? 0;
  return (
    <span className="countdown guess-clock" role="timer">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}
