import type { CSSProperties, ReactNode } from "react";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="q-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="q-seg__opt"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A tiny rotation per chip index so a wall of chips looks hand-placed. */
const TILTS = [-0.5, 0.6, -0.7, 0.4, -0.3, 0.7];

export function Chip({
  selected,
  onToggle,
  children,
  index = 0,
  style,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  index?: number;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      className="q-chip"
      aria-pressed={selected}
      onClick={onToggle}
      style={{ rotate: selected ? `${TILTS[index % TILTS.length]}deg` : undefined, ...style }}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  large,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`q-toggle${large ? " q-toggle--lg" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="q-toggle__knob" />
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} className="q-check" onClick={() => onChange(!checked)}>
      <span className="q-check__box">{checked ? "✓" : ""}</span>
      {children}
    </button>
  );
}

export function Radio({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="q-radio" onClick={onSelect}>
      <span className="q-radio__dot" />
      <span>{children}</span>
    </button>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  prefix,
  label,
  maxLength,
  autoFocus,
  inputMode,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  label: string;
  maxLength?: number;
  autoFocus?: boolean;
  inputMode?: "text" | "numeric";
  autoComplete?: string;
}) {
  return (
    <label className="q-field">
      {prefix && <span className="q-field__prefix">{prefix}</span>}
      <input
        aria-label={label}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        inputMode={inputMode}
        autoComplete={autoComplete ?? "off"}
        autoCapitalize={prefix === "@" ? "none" : undefined}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Steps({ total, current }: { total: number; current: number }) {
  return (
    <div className="q-steps" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="q-steps__bar" data-on={i < current} />
      ))}
    </div>
  );
}
