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

export default defineConfig({
  base: "/g/",
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    // Quick Cloudflare tunnels for on-device testing over HTTPS.
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
      "/ws": { target: "http://localhost:8787", ws: true, changeOrigin: true },
    },
  },
  preview: {
    port: 5174,
    strictPort: true,
  },
});
