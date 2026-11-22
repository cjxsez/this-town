/**
 * MatchCard.tsx (glasses-web): who your match is and where to go.
 *
 * Driven by match.found: partner.firstName, partner.color (ColorSwatch), why (the one-line
 * "why you two", private to the two riders, fine on the lens), meetAtCar / carDelta /
 * youWalk -> "Kiosk 1 car back", "Stay put, Maya is coming to you", etc.
 *
 * Works with zero input: arriving is proven by tapping the meeting kiosk's tag, and the
 * mission also auto-starts after MISSION_AUTOSTART_DELAY_MS. "Not now" is on the phone.
 *
 * Optional input (temple touch strip, no Neural Band):
 *   select on "I'm here" (default focus) -> onArrived -> App sends rider.arrived
 *   select on "Not now", or back         -> onNotNow  -> App sends rider.notNow
 *   arrows move focus between the two buttons
 * Buttons are not real <button>s with DOM focus, so a select pinch never double-fires
 * (native click + our keydown handler).
 *
 * carDelta is relative to the rider's current car toward meetAtCar (worker matching).
 * Direction copy lives in lib/whereToGo.ts. Long why lines clamp to two lines (.match-why).
 */
import { useState } from "react";
import { ColorSwatch } from "../components/ColorSwatch";
import { useInput } from "../lib/input";
import type { MatchFound } from "../lib/socket";
import { whereToGo } from "../lib/whereToGo";

interface MatchCardProps {
  match: MatchFound;
  /** Rider's current car from ride.state; used when carDelta is 0 but meetAtCar differs. */
  currentCar?: string | null;
  arrived: boolean;
  onArrived: () => void;
  onNotNow: () => void;
}

type Focus = "here" | "notNow";

export function MatchCard({ match, currentCar, arrived, onArrived, onNotNow }: MatchCardProps) {
  const [focus, setFocus] = useState<Focus>("here");

  useInput((action) => {
    switch (action) {
      case "left":
      case "up":
        setFocus("here");
        return;
      case "right":
      case "down":
        setFocus("notNow");
        return;
      case "select":
        if (focus === "notNow") onNotNow();
        else if (!arrived) onArrived();
        return;
      case "back":
        onNotNow();
        return;
    }
  });

  return (
    <main className="hud">
      <div className="match-head">
        <ColorSwatch color={match.partner.color} />
        <div className="hud-title">{match.partner.firstName}</div>
      </div>
      <div className="hud-body hud-strong">{whereToGo(match, currentCar)}</div>
      <div className="hud-body match-why">{match.why}</div>
      <div className="hud-hint">Tap the kiosk tag when you get there</div>
      <div className="hud-row">
        <div className={`hud-btn ${focus === "here" ? "is-focused" : ""}`} role="button" aria-pressed={arrived}>
          {arrived ? `Waiting for ${match.partner.firstName}…` : "I'm here"}
        </div>
        <div className={`hud-btn ${focus === "notNow" ? "is-focused" : ""}`} role="button">
          Not now
        </div>
      </div>
    </main>
  );
}
