/**
 * Stamp.tsx (glasses-web): brief celebration when a stamp is awarded.
 *
 * Driven by stamp.awarded (Stamp: station, line, partnerFirstName, rare). Auto-dismisses
 * after DISMISS_MS back to Idle; select or back dismisses early.
 *
 * TODO:
 * - Small stamp graphic (bright strokes on black, no filled white areas).
 * - Rare variant.
 */
import { useEffect, useRef } from "react";
import type { Stamp as StampModel } from "@questline/protocol";
import { useInput } from "../lib/input";

const DISMISS_MS = 4000;

interface StampProps {
  stamp: StampModel;
  onDone: () => void;
}

export function Stamp({ stamp, onDone }: StampProps) {
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
    <main className="hud hud-center">
      <div className="stamp-pop">{stamp.rare ? "Rare stamp!" : "Stamped!"}</div>
      <div className="hud-title">{stamp.station}</div>
      <div className="hud-body">
        {stamp.line} Line with {stamp.partnerFirstName}
      </div>
    </main>
  );
}
