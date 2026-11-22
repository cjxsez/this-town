/**
 * Vite config for glasses-web (Meta Ray-Ban Display Web App).
 *
 * - base "/g/": the worker serves this build at https://<domain>/g/ (SPA fallback per prefix).
 * - dev server on 5174, proxying /api (REST) and /ws (WebSockets) to the worker on 8787,
 *   so the page can use same-origin relative URLs in dev and prod.
 * - `vite preview` reuses the same proxy (preview.proxy defaults to server.proxy).
 *
 * TODO:
 * - If testing on real glasses against the dev server through a tunnel, add the tunnel
 *   host to server.allowedHosts (Vite blocks unknown Host headers by default).
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Other ports for a second checkout: WORKER_PORT=8791 PORT=5184 pnpm dev
const worker = `http://localhost:${process.env.WORKER_PORT ?? 8787}`;
const port = Number(process.env.PORT ?? 5174);

export default defineConfig({
  base: "/g/",
  plugins: [react()],
  server: {
    port,
    strictPort: true,
    // Quick Cloudflare tunnels for on-device testing over HTTPS.
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": { target: worker, changeOrigin: true },
      "/ws": { target: worker, ws: true, changeOrigin: true },
    },
  },
  preview: {
    port,
    strictPort: true,
  },
});
