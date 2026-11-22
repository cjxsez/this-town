/**
 * Direction copy for the match card.
 * When carDelta is 0 but meetAtCar differs from the rider's car (unknown carOrder),
 * say "Go to car <label>" instead of "same car".
 */
import type { MatchFound } from "./socket";

export function whereToGo(m: MatchFound, currentCar?: string | null): string {
  const name = m.partner.firstName;
  const unknownOrder = m.carDelta === 0 && Boolean(currentCar) && m.meetAtCar !== currentCar;
  if (unknownOrder) return `Go to car ${m.meetAtCar}`;
  if (!m.youWalk) {
    return m.carDelta === 0 ? "Same car. Head to the kiosk" : `Stay put. ${name} is coming to your kiosk`;
  }
  if (m.carDelta === 0) return "Same car. Head to the kiosk";
  const n = Math.abs(m.carDelta);
  const dir = m.carDelta < 0 ? "back" : "forward";
  return `Kiosk ${n} car${n === 1 ? "" : "s"} ${dir}`;
}
