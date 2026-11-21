/**
 * main.tsx (kiosk-web): React entry. Mounts <App /> into #root (800x480).
 *
 * Also blocks the context menu and pinch zoom, since riders can touch the screen.
 * No API or socket use here.
 *
 * TODO:
 * - Global error boundary that reloads the page after a few seconds (unattended kiosk).
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("gesturestart", (e) => e.preventDefault());

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
