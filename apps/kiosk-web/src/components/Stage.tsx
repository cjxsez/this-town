/**
 * Stage.tsx (kiosk-web): an 800x480 stage (the Pi's 7" screen) scaled to fit the window.
 * On the Pi the scale is 1. On a laptop or TV the stage fills the screen and the page
 * background (`bg`, the screen's own color) fills the letterbox, so it reads edge to edge.
 */
import { useEffect, useState, type ReactNode } from "react";

const W = 800;
const H = 480;

function fit(): number {
  return Math.min(window.innerWidth / W, window.innerHeight / H);
}

export function Stage({ bg, children }: { bg: string; children: ReactNode }) {
  const [scale, setScale] = useState(fit);

  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.setProperty("--k-bg", bg);
  }, [bg]);

  return (
    <div className="k-stage" style={{ transform: scale === 1 ? undefined : `scale(${scale})` }}>
      {children}
    </div>
  );
}
