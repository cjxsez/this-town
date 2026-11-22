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

// Other ports for a second checkout: WORKER_PORT=8791 PORT=5184 pnpm dev
const worker = `http://localhost:${process.env.WORKER_PORT ?? 8787}`;
const port = Number(process.env.PORT ?? 5173);

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    port,
    strictPort: true,
    host: true,
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
