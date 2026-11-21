// Copies the three built web apps into apps/worker/public so the Worker can serve them
// from its ASSETS binding on one origin:
//   apps/phone-web/dist   -> apps/worker/public/
//   apps/glasses-web/dist -> apps/worker/public/g/
//   apps/kiosk-web/dist   -> apps/worker/public/kiosk/
// Run via `pnpm build` from the repo root (it builds the apps first).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/worker/public");

const apps = [
  { from: "apps/phone-web/dist", to: "" },
  { from: "apps/glasses-web/dist", to: "g" },
  { from: "apps/kiosk-web/dist", to: "kiosk" },
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const app of apps) {
  const src = join(root, app.from);
  if (!existsSync(src)) {
    console.error(`missing ${app.from}, run the app's build first`);
    process.exit(1);
  }
  cpSync(src, join(out, app.to), { recursive: true });
  console.log(`copied ${app.from} -> apps/worker/public/${app.to}`);
}
