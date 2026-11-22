import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { ArtSlot, BackLink } from "../../ui";
import type { Memory, Station } from "../../../shared/types";
import "./collection.css";

/** The kit's BackLink in the paper-button dress the hi-fi uses on H3/H5. */
export function PaperBack({ to, children }: { to: string; children: ReactNode }) {
  return (
    <div className="cl-back">
      <BackLink to={to}>{children}</BackLink>
    </div>
  );
}

/** "KEN-MORE" → ["KEN-", "MORE"], "BU EAST" → ["BU", "EAST"]: the two-line ticket label. */
export function ticketLines(short: string): string[] {
  const hy = short.indexOf("-");
  if (hy > 0) return [short.slice(0, hy + 1), short.slice(hy + 1)];
  const sp = short.indexOf(" ");
  if (sp > 0) return [short.slice(0, sp), short.slice(sp + 1)];
  return [short];
}

const TicketName = ({ short }: { short: string }) => (
  <>
    {ticketLines(short).map((l, i) => (
      <span key={i} style={{ display: "block" }}>
        {l}
      </span>
    ))}
  </>
);

/** Small passport ticket. Earned: cream (or yellow for rare) with a barcode; links to the stamp. */
export function EarnedTicket({
  station,
  to,
  rare,
  isNew,
}: {
  station: Station;
  to: string;
  rare: boolean;
  isNew: boolean;
}) {
  const tag = rare ? "★ RARE" : isNew ? "NEW" : "✓";
  const label = `${station.name} stamp${rare ? ", rare" : ""}${isNew ? ", new today" : ""}`;
  return (
    <Link to={to} className={`cl-ticket${rare ? " cl-ticket--rare" : ""}`} aria-label={label}>
      <div className="cl-ticket__tilt">
        <div className="cl-ticket__ol">
          <div className="cl-ticket__paper" aria-hidden>
            <div className="cl-ticket__name">
              <TicketName short={station.short} />
            </div>
            <div className="cl-ticket__bars" />
            <div className="cl-ticket__tag">{tag}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Dashed empty ticket: a station still on the goal list. */
export function EmptyTicket({ station }: { station: Station }) {
  return (
    <div className="cl-ticket cl-ticket--empty" role="img" aria-label={`${station.name}, not stamped yet`}>
      <span aria-hidden>
        <TicketName short={station.short} />
      </span>
    </div>
  );
}

/** A memory photo: the real image once the backend sends one, else the art placeholder. */
export function MemoryPhoto({
  memory,
  name,
  style,
  placeholder,
}: {
  memory: Memory;
  name: string;
  style?: CSSProperties;
  placeholder?: string;
}) {
  return (
    <div className="cl-photo" style={style}>
      {memory.imageUrl ? (
        <img src={memory.imageUrl} alt={`Photo of you and ${name}`} />
      ) : (
        <ArtSlot id={`memory-${memory.id}`} placeholder={placeholder ?? `photo: you + ${name}`} style={{ width: "100%", height: "100%" }} />
      )}
    </div>
  );
}
