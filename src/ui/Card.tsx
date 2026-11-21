import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  ink,
  flat,
  tight,
  className,
  style,
}: {
  children: ReactNode;
  ink?: boolean;
  flat?: boolean;
  tight?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const cls = ["q-card", ink && "q-card--ink", flat && "q-card--flat", tight && "q-card--tight", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}
