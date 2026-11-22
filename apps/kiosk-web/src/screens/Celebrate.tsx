/**
 * Celebrate.tsx (kiosk-web): stamp awarded.
 *
 * Driven by celebrate: color (background + rays), rare (gold rays, "Rare stamp").
 * First names come from the stored pair.incoming for the same matchId. A ticket stamps
 * down like the phone's stamp ticket, with a little paper confetti.
 * App returns to Idle after CELEBRATE_MS or on pair.cleared, whichever is first.
 */
import { PAIR_COLOR_HEX, RARE_ACCENT_HEX, type PairColor } from "@questline/protocol";
import { PairToken, Screen } from "../components/Ui";

interface CelebrateProps {
  color: PairColor;
  rare: boolean;
  firstNames: [string, string] | null;
}

const CONFETTI = ["var(--yellow)", "var(--paper)", "var(--sky)", "var(--leaf)", "var(--red)", "var(--paper)"];

export function Celebrate({ color, rare, firstNames }: CelebrateProps) {
  return (
    <Screen label="Stamped" blobs={false} className="k-celebrate" style={{ background: rare ? RARE_ACCENT_HEX : PAIR_COLOR_HEX[color] }}>
      <div className="k-rays" aria-hidden />
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="k-confetti"
          aria-hidden
          style={{ left: -200 + i * 90, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i * 0.37) % 3}s`, animationDuration: `${2.6 + (i % 4) * 0.4}s` }}
        />
      ))}
      <section className="k-card k-ticket">
        <div className="k-eyebrow" style={{ color: "var(--ink)" }}>{rare ? "★ Rare stamp ★" : "In This Town"}</div>
        <div className="k-ticket__word">Stamped!</div>
        {firstNames && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PairToken color={color} name={firstNames[0]} size={48} />
            <span className="k-title" style={{ fontSize: 28 }}>
              {firstNames[0]} &amp; {firstNames[1]}
            </span>
            <PairToken color={color} name={firstNames[1]} size={48} />
          </div>
        )}
        <p className="k-body" style={{ fontSize: 24 }}>It's in both your passports.</p>
      </section>
    </Screen>
  );
}
