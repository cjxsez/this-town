import { useMemo } from "react";
import { useParams } from "react-router";
import { STATIONS, stationById } from "../../../shared/catalog";
import { encodeQr, qrPath } from "./qr";

/**
 * A1 QR poster, printed for the platform. Renders outside the phone shell at
 * US Letter portrait. Everything is sized in --u (a tenth of an inch on
 * paper), so the on-screen preview is the same sheet scaled to the window.
 */
const CSS = `
.ql-poster-page {
  --u: min(0.1in, (100vw - 32px) / 85);
  min-height: 100dvh; width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 16px; background: var(--page); color: var(--ink);
}
.ql-poster {
  width: calc(var(--u) * 85); height: calc(var(--u) * 110);
  display: flex; flex-direction: column;
  background: var(--paper); border: calc(var(--u) * 0.6) solid var(--ink);
  border-radius: 5px 8px 4px 7px; box-shadow: 3px 5px 0 var(--shadow);
  overflow: hidden;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.ql-poster__head {
  background: var(--yellow); border-bottom: calc(var(--u) * 0.6) solid var(--ink);
  padding: calc(var(--u) * 5) calc(var(--u) * 6) calc(var(--u) * 4);
}
.ql-poster__title { font: 400 calc(var(--u) * 6.6)/1.02 var(--font-display); }
.ql-poster__body {
  flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: calc(var(--u) * 4.5) calc(var(--u) * 6) calc(var(--u) * 4); gap: calc(var(--u) * 2.5);
}
.ql-poster__pitch { font: 700 calc(var(--u) * 5.6)/1.03 var(--font-hand); text-wrap: balance; }
.ql-poster__qr {
  width: calc(var(--u) * 30); height: calc(var(--u) * 30);
  padding: 0; background: #fff; border: calc(var(--u) * 0.6) solid var(--ink);
}
.ql-poster__qr svg { width: 100%; height: 100%; }
.ql-poster__eyebrow { font: 400 calc(var(--u) * 1.8)/1.3 var(--font-display); letter-spacing: .08em; color: var(--ink-soft); }
.ql-poster__url { font: 700 calc(var(--u) * 5.4)/1.05 var(--font-hand); margin-top: calc(var(--u) * 0.6); }
.ql-poster__foot {
  width: 100%; margin-top: auto; border-top: calc(var(--u) * 0.5) dashed var(--ink);
  padding-top: calc(var(--u) * 2.6); font: 700 calc(var(--u) * 4.4)/1.08 var(--font-hand);
}
.ql-print-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center; }
.ql-print-bar .q-btn { flex: none; min-width: 200px; }

@page { size: letter portrait; margin: 0; }
@media print {
  html, body, #root { background: #fff !important; height: auto !important; display: block !important; }
  .ql-poster-page { --u: 0.1in; padding: 0; min-height: 0; background: #fff; }
  .ql-poster { box-shadow: none; border-radius: 0; filter: none; border: 0; }
  .ql-no-print { display: none !important; }
}
`;

export default function Poster() {
  const { stationId = "kenmore" } = useParams();
  const station = stationById(stationId.toLowerCase()) ?? STATIONS[0];
  const short = `questline.page/${station.id}`;
  const path = useMemo(() => {
    const m = encodeQr(`https://${short}`);
    return { d: qrPath(m, 4), size: m.length + 8 }; // 4-module quiet zone
  }, [short]);

  return (
    <div className="ql-poster-page">
      <style>{CSS}</style>
      <div className="ql-print-bar ql-no-print">
        <button type="button" className="q-btn" onClick={() => window.print()}>
          Print this poster
        </button>
      </div>

      <article className="ql-poster" aria-label={`In This Town poster for ${station.name}`}>
        <header className="ql-poster__head">
          <h1 className="ql-poster__title">SIDE QUESTS WHILE YOU WAIT FOR THE T</h1>
        </header>
        <div className="ql-poster__body">
          <p className="ql-poster__pitch">
            Meet one person.
            <br />
            Play 2 minutes.
            <br />
            Get a stamp.
          </p>
          <div className="ql-poster__qr">
            <svg
              viewBox={`0 0 ${path.size} ${path.size}`}
              shapeRendering="crispEdges"
              role="img"
              aria-label={`QR code for ${short}`}
            >
              <rect width={path.size} height={path.size} fill="#fff" />
              <path d={path.d} fill="#000" />
            </svg>
          </div>
          <div>
            <div className="ql-poster__eyebrow">SCAN, OR TYPE</div>
            <div className="ql-poster__url">
              questline.page/
              <br />
              {station.id}
            </div>
          </div>
          <div className="ql-poster__foot">Badges at the In This Town table</div>
        </div>
      </article>
    </div>
  );
}
