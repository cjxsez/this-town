/**
 * main.tsx (kiosk-web): React entry. Mounts <App /> into #root (800x480).
 *
 * Also blocks the context menu and pinch zoom, since riders can touch the screen.
 * ErrorBoundary reloads after a crash so an unattended kiosk recovers.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import "./styles.css";

window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("gesturestart", (e) => e.preventDefault());

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
