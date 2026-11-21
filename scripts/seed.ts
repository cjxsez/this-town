// Seeds demo profiles into the worker so matching has people to work with.
// Usage: pnpm seed            (targets http://localhost:8787)
//        WORKER_URL=https://<domain> pnpm seed
//
// Writes the created tokens to scripts/.seed-tokens.json (gitignored)
// so ghost-riders.ts can act as these users.
//
// TODO:
// - POST /api/users for each profile below
// - save { firstName, userId, token } to scripts/.seed-tokens.json
import type { Profile } from "@questline/protocol";

export const DEMO_PROFILES: Profile[] = [
  { firstName: "Maya", interests: ["food", "film", "books"], askMeAbout: "the best ramen in Allston", socialBattery: "quick-chat", status: "student", languages: ["English", "Spanish"], is18Plus: true },
  { firstName: "Theo", interests: ["climbing", "tech", "coffee"], askMeAbout: "bouldering gyms", socialBattery: "lets-talk", status: "local", languages: ["English"], is18Plus: true },
  { firstName: "Priya", interests: ["design", "art", "travel"], askMeAbout: "my sketchbook", socialBattery: "quick-chat", status: "visitor", languages: ["English", "Hindi"], is18Plus: true },
  { firstName: "Sam", interests: ["sports", "music", "food"], askMeAbout: "Celtics", socialBattery: "nod", status: "local", languages: ["English"], is18Plus: true },
  { firstName: "Lena", interests: ["startups", "ai", "running"], askMeAbout: "marathon training", socialBattery: "lets-talk", status: "student", languages: ["English", "German"], is18Plus: true },
];

async function main(): Promise<void> {
  const base = process.env.WORKER_URL ?? "http://localhost:8787";
  console.log(`TODO: seed ${DEMO_PROFILES.length} profiles into ${base}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
