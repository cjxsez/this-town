import { useEffect } from "react";
import type { TimeOfDay } from "../../shared/types";
import { useApp } from "../state/store";

/** sea, foam, onsea, foam2 per time of day, from the design's theme switch. */
const PALETTES: Record<TimeOfDay, [string, string, string, string]> = {
  Day: ["#62C1BC", "#9AE4D6", "#26343B", "#7FD3C8"],
  Dusk: ["#F0A583", "#FBD3BC", "#26343B", "#F5BA9C"],
  Night: ["#2B4656", "#4A7286", "#F4F5EC", "#3A5C70"],
};

const SEEDS = [7, 23, 41];

/**
 * The hand-drawn look: two SVG displacement filters (wobbly outlines and
 * ragged foam blobs) plus a "boil" that reseeds the outline noise a few times
 * a second, like redrawn animation frames.
 */
export function HandDrawnFx() {
  const { timeOfDay, handDrawn, motion } = useApp().state.settings;

  useEffect(() => {
    const st = document.documentElement.style;
    const [sea, foam, onsea, foam2] = PALETTES[timeOfDay];
    st.setProperty("--sea", sea);
    st.setProperty("--foam", foam);
    st.setProperty("--onsea", onsea);
    st.setProperty("--foam2", foam2);
    st.setProperty("--wob", handDrawn ? "url(#ql-wob)" : "none");
    st.setProperty("--rag", handDrawn ? "url(#ql-rag)" : "none");
    document.documentElement.classList.toggle("no-motion", !motion);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", sea);
  }, [timeOfDay, handDrawn, motion]);

  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!handDrawn || !motion || still) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % SEEDS.length;
      document.querySelector("#ql-wob feTurbulence")?.setAttribute("seed", String(SEEDS[i]));
    }, 220);
    return () => clearInterval(id);
  }, [handDrawn, motion]);

  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <filter id="ql-wob" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={7} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="ql-rag" x="-18%" y="-18%" width="136%" height="136%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={3} seed={3} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={34} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
