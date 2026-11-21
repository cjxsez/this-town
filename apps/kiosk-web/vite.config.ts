/**
 * Vite config for kiosk-web (the touchscreen in each train car).
 *
 * - base "/kiosk/": the worker serves this build at https://<domain>/kiosk/:car
 *   (SPA fallback: anything under /kiosk/ that is not a file returns /kiosk/index.html).
 * - dev server on 5175, proxying /api (REST) and /ws (WebSockets) to the worker on 8787.
 *   Dev URL: http://localhost:5175/kiosk/1412?key=<KIOSK_KEY>
 * - `vite preview` reuses the same proxy (preview.proxy defaults to server.proxy).
 *
 * TODO:
 * - If a Pi on the LAN loads the dev server, run with `--host` and add its host to
 *   server.allowedHosts.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/kiosk/",
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
      "/ws": { target: "http://localhost:8787", ws: true, changeOrigin: true },
    },
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
});
