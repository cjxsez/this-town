// Seeds demo profiles into the worker so matching has people to work with.
// Usage: pnpm seed            (targets http://localhost:8787)
//        WORKER_URL=https://<domain> pnpm seed
//
// Writes { firstName, userId, token } per profile to scripts/.seed-tokens.json (gitignored)
// so ghost-riders.ts can act as these users. Running it again creates fresh users.
import { writeFileSync } from "node:fs";
import type { Profile } from "@questline/protocol";

export const DEMO_PROFILES: Profile[] = [
  { firstName: "Maya", interests: ["ramen", "film", "bookstores"], askMeAbout: "the best ramen in Allston", socialBattery: "chat", status: "student", languages: ["English", "Spanish"], is18Plus: true },
  { firstName: "Theo", interests: ["climbing", "hackathons", "coffee"], askMeAbout: "bouldering gyms", socialBattery: "talk", status: "local", languages: ["English"], is18Plus: true },
  { firstName: "Priya", interests: ["architecture", "museums", "photography"], askMeAbout: "my sketchbook", socialBattery: "chat", status: "visiting", languages: ["English", "Hindi"], is18Plus: true },
  { firstName: "Sam", interests: ["celtics", "live-music", "dumplings"], askMeAbout: "Celtics", socialBattery: "nod", status: "local", languages: ["English"], is18Plus: true },
  { firstName: "Lena", interests: ["ai", "running", "marathon"], askMeAbout: "marathon training", socialBattery: "talk", status: "student", languages: ["English", "German"], is18Plus: true },
];

export const TOKENS_FILE = new URL("./.seed-tokens.json", import.meta.url);

async function main(): Promise<void> {
  const base = (process.env.WORKER_URL ?? "http://localhost:8787").replace(/\/+$/, "");
  const out: { firstName: string; userId: string; token: string }[] = [];
  for (const p of DEMO_PROFILES) {
    const res = await fetch(`${base}/api/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error(`POST /api/users for ${p.firstName}: ${res.status} ${await res.text()}`);
    const { userId, token } = (await res.json()) as { userId: string; token: string };
    out.push({ firstName: p.firstName, userId, token });
    console.log(`created ${p.firstName} (${userId})`);
  }
  writeFileSync(TOKENS_FILE, JSON.stringify(out, null, 2));
  console.log(`saved ${out.length} tokens to scripts/.seed-tokens.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
