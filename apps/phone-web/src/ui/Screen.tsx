import type { CSSProperties, ReactNode } from "react";
import { TabBar } from "./TabBar";

/** Foam blob presets, matching the two background clouds each hi-fi screen draws. */
const BLOBS = {
  a: [
    { left: -70, top: 70, width: 300, height: 170, borderRadius: "46% 54% 60% 40%/55% 45% 55% 45%" },
    { left: 210, top: 150, width: 260, height: 150, borderRadius: "58% 42% 45% 55%/45% 60% 40% 55%" },
  ],
  b: [
    { left: 150, top: 40, width: 320, height: 180, borderRadius: "46% 54% 60% 40%/55% 45% 55% 45%" },
    { left: -90, top: 190, width: 280, height: 150, borderRadius: "58% 42% 45% 55%/45% 60% 40% 55%" },
  ],
  c: [
    { left: -40, top: 130, width: 340, height: 190, borderRadius: "46% 54% 60% 40%/55% 45% 55% 45%" },
    { left: 230, top: 20, width: 240, height: 140, borderRadius: "58% 42% 45% 55%/45% 60% 40% 55%" },
  ],
} satisfies Record<string, CSSProperties[]>;

export interface ScreenProps {
  children: ReactNode;
  /** Bottom actions pinned below the scrolling body (thumb zone). */
  footer?: ReactNode;
  /** Show the Ride / Passport / People / Me bar. */
  tabs?: boolean;
  blobs?: keyof typeof BLOBS | false;
  /** Override the sea colour, e.g. the dark train-coming takeover. */
  background?: string;
  bodyStyle?: CSSProperties;
  className?: string;
  label?: string; // screen id from the wireframe, e.g. "C2"; useful in devtools
}

export function Screen({ children, footer, tabs, blobs = "a", background, bodyStyle, className, label }: ScreenProps) {
  return (
    <div className={`q-screen ${className ?? ""}`} style={background ? { background } : undefined} data-screen={label}>
      {blobs && BLOBS[blobs].map((s, i) => <div key={i} className="q-blob" style={s} />)}
      <div className="q-screen__body" style={bodyStyle}>
        {children}
      </div>
      {footer && <div className="q-screen__foot">{footer}</div>}
      {tabs && <TabBar />}
    </div>
  );
}
