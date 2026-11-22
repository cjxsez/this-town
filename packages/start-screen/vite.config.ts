/**
 * Vite config for the start screen's own preview page.
 *
 * - dev server on 5180 (the apps use 5173 to 5175 and the worker 8787).
 * - host: true so a real phone on the same Wi-Fi can open http://<laptop-ip>:5180.
 * - The package itself is consumed as source (see "exports" in package.json), so
 *   `vite build` here only builds the preview page.
 */
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5180, strictPort: true, host: true, allowedHosts: [".trycloudflare.com"] },
  preview: { port: 5180, strictPort: true },
  // three.js alone is about 600 kB minified (160 kB gzipped); that is expected here.
  build: { chunkSizeWarningLimit: 700 },
});
