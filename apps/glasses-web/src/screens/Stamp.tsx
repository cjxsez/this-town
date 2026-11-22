/**
 * Stamp.tsx (glasses-web): brief celebration when a stamp is awarded.
 *
 * Driven by stamp.awarded (Stamp: station, line, partnerFirstName, rare). Auto-dismisses
 * after DISMISS_MS back to Idle; select or back dismisses early. Rare uses the warn accent.
 * Body copy follows GET /api/health gamesOnly (lib/rideCopy.ts): games-only says they played
 * the three games together; mission mode keeps "{line} Line with {name}".
 */
import { useEffect, useRef } from "react";
import type { Stamp as StampModel } from "@questline/protocol";
import { useInput } from "../lib/input";
import { stampWithLine } from "../lib/rideCopy";

const DISMISS_MS = 4000;

interface StampProps {
  stamp: StampModel;
  onDone: () => void;
  /** From GET /api/health; false keeps "{line} Line with {name}". */
  gamesOnly?: boolean;
}

export function Stamp({ stamp, onDone, gamesOnly = false }: StampProps) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const id = window.setTimeout(() => onDoneRef.current(), DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [stamp.id]);

  useInput((action) => {
    if (action === "select" || action === "back") onDone();
  });

  return (
    <main className="hud hud-center" aria-live="polite">
      <div className={`stamp-pop${stamp.rare ? " stamp-pop--rare" : ""}`}>
        {stamp.rare ? "Rare stamp!" : "Stamped!"}
      </div>
      <div className="hud-title">{stamp.station}</div>
      <div className="hud-body">{stampWithLine(stamp.line, stamp.partnerFirstName, gamesOnly)}</div>
    </main>
  );
}
