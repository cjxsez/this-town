import { useParams } from "react-router";
import { ArtSlot } from "../../ui";
import { BADGE_COLORS, badgeFor } from "../../../shared/catalog";
import { TagGrid } from "./tag";

/**
 * A2 The badge (front), printed one per page. The tag is 14 cm across (its
 * black 6×6 area) so glasses and phone cameras can read it from a few metres.
 * Everything is sized in --cm: a real centimetre on paper, scaled to fit the
 * window on screen.
 */
const CSS = `
.ql-badge-page {
  --cm: min(1cm, (100vw - 32px) / 19);
  min-height: 100dvh; width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 16px; background: var(--page); color: var(--ink);
}
.ql-badge-wrap { display: flex; flex-direction: column; align-items: center; }
.ql-badge-string { width: 4px; height: calc(var(--cm) * 2.4); background: var(--ink); }
.ql-badge {
  width: calc(var(--cm) * 18);
  display: flex; flex-direction: column; align-items: center; gap: calc(var(--cm) * 0.55);
  padding: calc(var(--cm) * 0.8) calc(var(--cm) * 1) calc(var(--cm) * 1);
  background: var(--paper); color: var(--ink);
  border: var(--ol) solid var(--ink); border-radius: 7px 4px 8px 5px;
  box-shadow: 3px 5px 0 var(--shadow); filter: var(--wob);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.ql-badge__hole {
  width: calc(var(--cm) * 4); height: calc(var(--cm) * 0.8);
  border: var(--ol) solid var(--ink); border-radius: calc(var(--cm) * 0.4); background: var(--page);
}
.ql-badge__label { font: 400 calc(var(--cm) * 0.36)/1.3 var(--font-display); letter-spacing: .06em; color: var(--ink-soft); text-align: center; }
.ql-badge__note { font: 400 calc(var(--cm) * 0.42)/1.2 var(--font-hand); color: var(--ink-soft); text-align: center; margin-top: calc(var(--cm) * -0.35); }
.ql-badge__who { display: flex; align-items: center; gap: calc(var(--cm) * 0.9); margin-top: calc(var(--cm) * 0.2); }
.ql-badge__art {
  flex: none; width: calc(var(--cm) * 4.2); height: calc(var(--cm) * 4.2);
  border-radius: 50%; overflow: hidden; border: 3px solid var(--ink);
}
.ql-badge__name { font: 400 calc(var(--cm) * 2)/1.02 var(--font-display); text-transform: uppercase; }
.ql-print-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center; }
.ql-print-bar .q-btn { flex: none; min-width: 200px; }

@page { margin: 0.8cm; }
@media print {
  html, body, #root { background: #fff !important; height: auto !important; display: block !important; }
  .ql-badge-page { --cm: 1cm; padding: 0; min-height: 0; background: #fff; }
  .ql-badge { box-shadow: none; filter: none; }
  .ql-no-print { display: none !important; }
}
`;

export default function BadgePrint() {
  const { number = "" } = useParams();
  const n = Number(number);
  const valid = Number.isInteger(n) && n >= 1 && n <= 48;

  if (!valid) {
    return (
      <div className="ql-badge-page" style={{ justifyContent: "center" }}>
        <style>{CSS}</style>
        <p className="q-title--sm">Badges are numbered 1 to 48.</p>
      </div>
    );
  }

  const badge = badgeFor(n);
  const lightBg = badge.color === "yellow" || badge.color === "blue";

  return (
    <div className="ql-badge-page">
      <style>{CSS}</style>
      <div className="ql-print-bar ql-no-print">
        <button type="button" className="q-btn" onClick={() => window.print()}>
          Print badge #{n}
        </button>
      </div>

      <div className="ql-badge-wrap">
        <div className="ql-badge-string ql-no-print" aria-hidden />
        <article className="ql-badge" aria-label={`Badge ${n}, ${badge.color} ${badge.animal}`}>
          <div className="ql-badge__hole" aria-hidden />
          <div className="ql-badge__label ql-no-print">LANYARD HOLE</div>
          <TagGrid n={n} cell="calc(var(--cm) * 14 / 6)" pad="calc(var(--cm) * 0.9)" />
          <div className="ql-badge__label">ARUCO 4×4 TAG · 14 CM · BADGE #{n}</div>
          {/* PLACEHOLDER: the grid is a stand-in, not the real ArUco dictionary (see tag.tsx). */}
          <div className="ql-badge__note">placeholder pattern, not a real ArUco marker yet</div>
          <div className="ql-badge__who">
            <div
              className="ql-badge__art"
              style={{ background: BADGE_COLORS[badge.color], color: lightBg ? "var(--ink)" : "var(--paper)" }}
            >
              <ArtSlot
                id={`animal-${badge.color}-${badge.animal}`}
                placeholder={`${badge.color} ${badge.animal} art`}
                round
                style={{ width: "100%", height: "100%", border: 0, background: "transparent", color: "inherit" }}
              />
            </div>
            <div className="ql-badge__name">
              {badge.color}
              <br />
              {badge.animal}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
