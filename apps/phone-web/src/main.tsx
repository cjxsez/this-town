/**
 * main.tsx: phone-web entry point.
 *
 * Responsible for: mounting <App /> (the router) into #root inside StrictMode and loading
 * the global stylesheet. Nothing else lives here; the rider socket opens lazily from
 * useRide.ts the first time a screen subscribes.
 *
 * Uses: no routes or events directly.
 *
 * TODO:
 * - Register a service worker only if we decide we need offline (we probably do not; a
 *   home-screen install would split localStorage from Safari on iOS, see README).
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root missing from index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
