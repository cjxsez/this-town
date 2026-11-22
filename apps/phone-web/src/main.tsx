import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { trackVisualViewport } from "./lib/viewport";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/anim.css";

trackVisualViewport();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
