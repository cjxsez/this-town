import type { CSSProperties, ReactNode } from "react";

type P = { children: ReactNode; style?: CSSProperties; className?: string };

export const Title = ({ children, style, size }: P & { size?: "lg" | "md" | "sm" }) => (
  <h1 className={size === "md" ? "q-title--md" : size === "sm" ? "q-title--sm" : "q-title"} style={style}>
    {children}
  </h1>
);
export const Display = ({ children, style }: P) => (
  <div className="q-display" style={style}>
    {children}
  </div>
);
export const Eyebrow = ({ children, style }: P) => (
  <div className="q-eyebrow" style={style}>
    {children}
  </div>
);
export const Body = ({ children, style }: P) => (
  <p className="q-body" style={style}>
    {children}
  </p>
);
export const Hint = ({ children, style }: P) => (
  <p className="q-hint" style={style}>
    {children}
  </p>
);
