/**
 * Idle.tsx (kiosk-web): the default screen, readable from across the car.
 *
 * Driven by kiosk.idle: ridersInCar, ridersOnTrain, nextStop, nextStopEtaSec (shown as a
 * countdown). The big yellow card points riders at the NFC tag: tapping it with a phone
 * opens /k/<car> on phone-web and checks the rider in. A trolley rolls along the town
 * strip at the bottom so the screen never looks frozen.
 *
 * Touch/click anywhere shows a 10 s "How it works" overlay (three steps, no names or
 * interests). Tap again closes it early.
 *
 * Public screen: counts only, no names here.
 */
import { useEffect, useState } from "react";
import type { ServerToKiosk } from "@questline/protocol";
import { Countdown } from "../components/Countdown";
import { NfcMark, Screen, Wordmark, art } from "../components/Ui";

export type IdleStats = Omit<Extract<ServerToKiosk, { type: "kiosk.idle" }>, "type" | "serverNow">;

interface IdleProps {
  car: string;
  stats: IdleStats | null;
  /** Epoch ms of the next stop, computed when kiosk.idle arrived. */
  nextStopAt: number | null;
}

const HOW_IT_WORKS_MS = 10_000;

const STEPS = [
  "Tap the kiosk tag with your phone when you board.",
  "Get matched with a rider who shares your interests.",
  "Meet at the kiosk, do the mission, both tap for a stamp.",
] as const;

export function Idle({ car, stats, nextStopAt }: IdleProps) {
  const [howTo, setHowTo] = useState(false);

  useEffect(() => {
    if (!howTo) return;
    const id = window.setTimeout(() => setHowTo(false), HOW_IT_WORKS_MS);
    return () => window.clearTimeout(id);
  }, [howTo]);

  return (
    <Screen
      label="Kiosk idle"
      blobs="a"
      onClick={() => setHowTo((open) => !open)}
      style={{ cursor: "pointer" }}
    >
      <header className="k-topbar">
        <Wordmark size={24} />
        <span className="k-pill k-pill--dark">Car {car}</span>
      </header>

      <div style={{ display: "flex", gap: 18, alignItems: "stretch" }}>
        <section className="k-card k-card--yellow" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 22, padding: "20px 24px", borderRadius: "var(--r1)" }}>
          <NfcMark size={124} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div className="k-eyebrow">Tap the tag on this kiosk</div>
            <h1 className="k-display" style={{ fontSize: 44 }}>Tap to play</h1>
            <p className="k-body" style={{ fontSize: 24 }}>Meet someone on this train who likes what you like.</p>
          </div>
        </section>

        <div style={{ width: 196, display: "flex", flexDirection: "column", gap: 12 }}>
          <Stat n={stats?.ridersInCar} label="playing in this car" />
          <Stat n={stats?.ridersOnTrain} label="on this train" />
        </div>
      </div>

      <section className="k-card" style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: "10px 18px", borderRadius: "var(--r2)", marginRight: 214 }}>
        <span className="k-pill__dot" style={{ width: 18, height: 18, background: "var(--red)" }} />
        <span className="k-eyebrow" style={{ color: "var(--ink)" }}>Next stop</span>
        <span className="k-title" style={{ fontSize: 24, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {stats?.nextStop ?? "…"}
        </span>
        {nextStopAt !== null && <Countdown endsAt={nextStopAt} style={{ fontSize: 26 }} />}
      </section>

      <TownStrip />

      {howTo && (
        <div className="k-howto" role="dialog" aria-label="How it works">
          <div className="k-howto__card">
            <div className="k-eyebrow" style={{ color: "var(--ink)" }}>How it works</div>
            <ol className="k-howto__steps">
              {STEPS.map((step, i) => (
                <li key={step}>
                  <span className="k-howto__num">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="k-hint" style={{ margin: 0 }}>Tap again to close</p>
          </div>
        </div>
      )}
    </Screen>
  );
}

function Stat({ n, label }: { n: number | undefined; label: string }) {
  const value = n ?? "–";
  return (
    <div
      className="k-card"
      style={{ flex: 1, gap: 2, justifyContent: "center", padding: "10px 16px", borderRadius: "var(--r4)" }}
      aria-label={n === undefined ? `${label}: waiting` : `${n} ${label}`}
    >
      <span className="k-num" style={{ font: "400 46px/1 var(--font-display)" }} aria-hidden>
        {value}
      </span>
      <span className="k-hint" style={{ color: "var(--ink)", fontWeight: 700, lineHeight: 1.05 }} aria-hidden>
        {label}
      </span>
    </div>
  );
}

/** Ground, a dashed track, a few houses and trees, and a trolley rolling past. */
function TownStrip() {
  return (
    <div className="k-town" aria-hidden>
      <img src={art("sprite-house-pink.webp")} alt="" style={{ left: 40, height: 74 }} />
      <img src={art("sprite-tree.webp")} alt="" style={{ left: 116, height: 70 }} />
      <img src={art("sprite-house-red.webp")} alt="" style={{ left: 560, height: 78 }} />
      <img src={art("sprite-tree.webp")} alt="" style={{ left: 640, height: 64 }} />
      <img src={art("sprite-house-pink.webp")} alt="" style={{ left: 704, height: 70 }} />
      <div className="k-town__ground" />
      <div className="k-town__rail" />
      <img className="k-town__trolley" src={art("sprite-trolley-green.webp")} alt="" style={{ left: 0, bottom: 8, height: 62 }} />
    </div>
  );
}
