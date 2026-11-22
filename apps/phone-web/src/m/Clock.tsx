import { useSecondsLeft } from "./room";

/** The dark m:ss pill for a game deadline given in server time. */
export function Clock({ deadline, serverNow }: { deadline: number; serverNow: () => number }) {
  const left = useSecondsLeft(deadline, serverNow) ?? 0;
  return (
    <span className="m-clock" role="timer">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}
