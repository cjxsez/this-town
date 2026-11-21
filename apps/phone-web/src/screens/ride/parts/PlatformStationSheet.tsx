import { useEffect, useRef } from "react";
import { LINES, STATIONS } from "../../../../shared/catalog";
import { TextLink } from "../../../ui";

/**
 * Web riders pick their station from a list; the iPhone app gets it from the
 * platform beacon instead. Bottom sheet over the check-in screen.
 */
export function PlatformStationSheet({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    sheet.current?.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="q-scrim anim-fadeIn" onClick={onClose}>
      <div
        ref={sheet}
        className="q-sheet anim-sheetUp"
        role="dialog"
        aria-modal="true"
        aria-label="Pick your station"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "78%", paddingBottom: "calc(var(--safe-bottom) + 10px)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="q-title--sm">Which station?</div>
          <TextLink small onClick={onClose}>
            Close
          </TextLink>
        </div>
        <div role="radiogroup" aria-label="Station" style={{ overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
          {STATIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === current}
              className="q-row"
              onClick={() => onPick(s.id)}
              style={{ fontSize: 22 }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden
                  style={{
                    flex: "none",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "var(--ol) solid var(--ink)",
                    background: s.id === current ? "var(--ink)" : "var(--paper-hi)",
                  }}
                />
                {s.name}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {s.lines.map((l) => (
                  <span
                    key={l}
                    title={LINES[l].label}
                    style={{ width: 12, height: 12, borderRadius: "50%", background: LINES[l].hex, border: "1.5px solid var(--ink)" }}
                  />
                ))}
                {s.branches && (
                  <span style={{ font: "400 11px var(--font-display)", color: "var(--ink-soft)", marginLeft: 2 }}>
                    {s.branches.join(" ")}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
