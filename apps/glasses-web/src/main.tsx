/**
 * main.tsx (glasses-web): React entry. Mounts <App /> into #root (600x600).
 *
 * In dev, adds `dev-frame` to <html> so the 600x600 lens area is outlined in a normal
 * desktop browser window. No API or socket use here.
 *
 * TODO:
 * - Global error boundary that shows a plain "Something broke, pinch to reload" screen.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

if (import.meta.env.DEV) document.documentElement.classList.add("dev-frame");

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
