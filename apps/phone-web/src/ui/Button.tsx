import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

export type ButtonVariant = "primary" | "secondary" | "danger" | "leaf" | "dark";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  variant?: ButtonVariant;
  huge?: boolean;
  to?: string; // render as a router link
  style?: CSSProperties;
  children: ReactNode;
}

/** Buttons sit level, like the BEGIN button on the start screen. */
export function Button({ variant = "primary", huge, to, className, style, children, ...rest }: Props) {
  const cls = ["q-btn", variant !== "primary" && `q-btn--${variant}`, huge && "q-btn--huge", className]
    .filter(Boolean)
    .join(" ");
  const st = style;
  if (to) {
    return (
      <Link to={to} className={cls} style={st}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} style={st} {...rest}>
      {children}
    </button>
  );
}

/** Two equal buttons side by side. Skip and Yes are always the same size. */
export function ButtonRow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="q-btn-row" style={style}>
      {children}
    </div>
  );
}

export function TextLink({
  children,
  onClick,
  to,
  small,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  to?: string;
  small?: boolean;
  style?: CSSProperties;
}) {
  const cls = `q-link${small ? " q-link--sm" : ""}`;
  if (to)
    return (
      <Link to={to} className={cls} style={style}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={cls} onClick={onClick} style={style}>
      {children}
    </button>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="q-back">
      ← {children}
    </Link>
  );
}
