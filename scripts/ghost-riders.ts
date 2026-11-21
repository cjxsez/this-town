// Ghost riders: fake riders on the demo train so the kiosks and matching look alive.
// Usage: pnpm ghosts   (after pnpm seed)
//
// Each ghost uses a seeded token, checks in to a demo car via POST /api/taps,
// and holds a /ws/rider socket so it can be matched like a real person.
//
// TODO:
// - read scripts/.seed-tokens.json
// - for each ghost: POST /api/taps { car, destinationStop } on one of DEMO_CARS
// - open wss /ws/rider?token=, send rider.hello { client: "phone" }
// - on match.found: log it; optionally auto-tap for a stamp after a delay (to demo stamps solo)
// - flags: --count N, --car 1412, --no-match (sit in the train count only, never get paired)
// - Ctrl+C: POST /api/ride/end for every ghost
import type { ServerToRider } from "@questline/protocol";

export const DEMO_CARS = ["1412", "1413"] as const;
export const DEMO_DESTINATION = "Downtown Crossing";

export function onGhostEvent(name: string, event: ServerToRider): void {
  console.log(`[ghost ${name}]`, event.type);
}

async function main(): Promise<void> {
  console.log("TODO: start ghost riders on", DEMO_CARS.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
