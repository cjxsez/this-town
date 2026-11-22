// Renders the phone app's artwork: opens studio.html in headless Chrome, lets
// it draw every shot in src/studio/shots.ts, and saves the images to
// apps/phone-web/public/art/<id>.webp. The files are committed, so this only
// needs running after changing a model, a shot or a colour.
//
//   pnpm art                 all shots
//   pnpm art -- --only fox   shots whose id contains "fox"
//
// Needs Google Chrome. Set CHROME_PATH if it is not in the usual macOS place.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "../../apps/phone-web/public/art");
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt > 0 ? process.argv[onlyAt + 1] : "";
const debugPort = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await createServer({ root, logLevel: "error", server: { port: 5181, strictPort: false, host: "127.0.0.1" } });
await server.listen();
const port = server.httpServer.address().port;
const profile = mkdtempSync(join(tmpdir(), "art-"));
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

try {
  // Wait for Chrome's debugging endpoint, then open the studio in a new tab.
  let target;
  const url = `http://127.0.0.1:${port}/studio.html${only ? `?only=${encodeURIComponent(only)}` : ""}`;
  for (let i = 0; i < 100 && !target; i++) {
    await sleep(100);
    target = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: "PUT" }).then((r) => r.json()).catch(() => undefined);
  }
  if (!target) throw new Error(`Could not start Chrome at ${chromePath}`);

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let nextId = 0;
  const waiting = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    waiting.get(message.id)?.(message);
    waiting.delete(message.id);
  };
  const evaluate = (expression) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      waiting.set(id, (m) => (m.error || m.result?.exceptionDetails ? reject(new Error(JSON.stringify(m.error ?? m.result.exceptionDetails))) : resolve(m.result.result.value)));
      socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    });

  let done = false;
  for (let i = 0; i < 600 && !done; i++) {
    await sleep(100);
    done = await evaluate("window.__art?.done === true").catch(() => false);
  }
  if (!done) throw new Error("The studio page did not finish in 60 seconds.");
  const error = await evaluate("window.__art.error ?? ''");
  if (error) throw new Error(`The studio page failed: ${error}`);

  mkdirSync(outDir, { recursive: true });
  const ids = await evaluate("Object.keys(window.__art.shots)");
  for (const id of ids) {
    const dataUrl = await evaluate(`window.__art.shots[${JSON.stringify(id)}]`);
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
    writeFileSync(join(outDir, `${id}.webp`), bytes);
    console.log(`${id}.webp  ${(bytes.length / 1024).toFixed(1)} kB`);
  }
  console.log(`\n${ids.length} images written to apps/phone-web/public/art/`);
  socket.close();
} finally {
  // Let Chrome finish exiting before removing its profile folder.
  const exited = new Promise((resolve) => chrome.once("exit", resolve));
  chrome.kill();
  await Promise.race([exited, sleep(3000)]);
  await server.close();
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
