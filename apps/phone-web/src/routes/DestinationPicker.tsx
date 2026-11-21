/**
 * DestinationPicker.tsx: "Where are you getting off?" list, shown inside Tap.
 *
 * Responsible for: rendering the stops from TapRes "need-destination" ({ line, stops }) and
 * calling onPick(stop). Tap then re-sends POST /api/taps with destinationStop. The worker
 * remembers the destination for next time, so riders usually see this once per ride.
 *
 * Uses: no routes or events itself (Tap owns POST /api/taps).
 *
 * TODO:
 * - Search/filter for long lines, line color header, highlight last-used stop.
 * - Hide stops already passed once the worker sends the current stop.
 */
interface Props {
  line: string;
  stops: string[];
  onPick: (stop: string) => void;
  busy?: boolean;
}

export function DestinationPicker({ line, stops, onPick, busy }: Props) {
  return (
    <section className="stack">
      <h1>Where are you getting off?</h1>
      <p className="muted">
        {line} line. We only match you with riders who are still on board for at least one more
        stop, and check you out when you arrive.
      </p>
      <ul className="list">
        {stops.map((stop) => (
          <li key={stop}>
            <button className="option" disabled={busy} onClick={() => onPick(stop)}>
              {stop}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
