/**
 * Vite config for phone-web (the rider's phone app).
 *
 * - base "/": the worker serves this build at https://<domain>/ and falls back to
 *   /index.html for client routes, including the NFC landing route /k/:car.
 * - dev server on 5173, proxying /api (REST) and /ws (WebSockets) to the worker on 8787,
 *   so the app uses same-origin relative URLs in dev and prod.
 * - host: true so a real phone on the same Wi-Fi can open http://<laptop-ip>:5173/k/1412.
 * - `vite preview` reuses the same proxy (preview.proxy defaults to server.proxy).
 *
 * TODO:
 * - If testing NFC taps against the dev server through a tunnel, add the tunnel host to
 *   server.allowedHosts and write the tunnel URL to the test tag.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    // Quick Cloudflare tunnels for on-device testing over HTTPS.
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
      "/ws": { target: "http://localhost:8787", ws: true, changeOrigin: true },
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
