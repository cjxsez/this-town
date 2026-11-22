/**
 * main.tsx (glasses-web): React entry. Mounts the two-player games <Games /> at /g/, or the
 * ride HUD <App /> at /g/?ride, into #root (600x600).
 *
 * In dev, adds `dev-frame` to <html> so the 600x600 lens area is outlined in a normal
 * desktop browser window.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { Games } from "./Games";
import "./styles.css";

if (import.meta.env.DEV) document.documentElement.classList.add("dev-frame");

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

// /g/ is the games. The ride HUD (link code, match card, mission, stamp) is at /g/?ride
// until the two are joined up.
const screen = new URLSearchParams(location.search).has("ride") ? <App /> : <Games />;

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>{screen}</ErrorBoundary>
  </StrictMode>,
);
