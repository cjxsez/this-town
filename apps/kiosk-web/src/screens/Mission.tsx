/**
 * Mission.tsx (kiosk-web): the shared mission, the main surface while a pair plays.
 *
 * Driven by mission.show: color (card outline), mission.title, mission.prompt,
 * mission.category, mission.endsAt (countdown + draining bar), mission.rare. First names
 * come from the earlier pair.incoming for the same matchId (mission.show does not repeat
 * them). The bottom bar asks both riders to tap the tag; stamp.progress fills its dots.
 * The Pi rewrites the tag with a fresh nonce on nfc.write; both riders tapping it is what
 * earns the stamp (decision D8). Leaves on celebrate (-> Celebrate) or pair.cleared (-> Idle).
 *
 * Public screen: the prompt is a curated deck mission (never personal), names are first
 * names only.
 */
import { PAIR_COLOR_HEX, type Mission as MissionModel, type MissionCategory, type PairColor } from "@questline/protocol";
import { Countdown, Drain, useRemaining } from "../components/Countdown";
import { NfcMark, PairToken, Screen } from "../components/Ui";

const CATEGORY: Record<MissionCategory, string> = {
  create: "Make something together",
  "show-me": "Show me",
  spot: "Spot it",
  "quick-game": "Quick game",
  "late-bonus": "Late bonus",
};

interface MissionProps {
  color: PairColor;
  mission: MissionModel;
  firstNames: [string, string] | null;
  /** When mission.show arrived, for the draining bar. */
  startedAt: number;
  /** Riders who have tapped the tag for the stamp (stamp.progress). */
  tapped: number;
}

export function Mission({ color, mission, firstNames, startedAt, tapped }: MissionProps) {
  const hex = PAIR_COLOR_HEX[color];
  const over = useRemaining(mission.endsAt) <= 0;
  return (
    <Screen label="Mission" blobs="b">
      <header className="k-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {firstNames && (
            <div style={{ display: "flex" }}>
              <PairToken color={color} name={firstNames[0]} size={46} />
              <PairToken color={color} name={firstNames[1]} size={46} style={{ marginLeft: -12 }} />
            </div>
          )}
          <span className="k-pill" style={{ fontSize: 17 }}>
            {firstNames ? `${firstNames[0]} & ${firstNames[1]}` : "Mission"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {mission.rare && <span className="k-pill k-pill--yellow">★ Rare</span>}
          <span className="k-pill k-pill--dark">Mission</span>
        </div>
      </header>

      <div className="k-mission__main">
        <section className="k-card k-mission__card k-in" style={{ borderColor: hex, borderRadius: "var(--r1)" }}>
          <div className="k-eyebrow">{CATEGORY[mission.category]}</div>
          <h1 className="k-display" style={{ fontSize: mission.title.length > 28 ? 32 : 38 }}>{mission.title}</h1>
          <p className="k-body" style={{ fontSize: mission.prompt.length > 110 ? 24 : 28 }}>{mission.prompt}</p>
        </section>

        <section className="k-card k-card--ink k-mission__clock">
          <div className="k-eyebrow">{over ? "Time's up" : "Time left"}</div>
          <Countdown endsAt={mission.endsAt} style={{ fontSize: 64, lineHeight: 1 }} />
          <Drain startedAt={startedAt} endsAt={mission.endsAt} />
        </section>
      </div>

      <section className="k-card k-card--yellow k-stamp-bar" style={{ borderRadius: "var(--r2)" }}>
        <NfcMark size={58} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="k-title" style={{ fontSize: 22 }}>
            {tapped >= 2 ? "Both tapped!" : tapped === 1 ? "1 of 2 tapped" : "Both tap the tag"}
          </span>
          <span className="k-hint" style={{ color: "var(--ink)", fontSize: 20 }}>
            {tapped >= 2 ? "Stamp coming up." : "That's how you get your stamp."}
          </span>
        </div>
        <div className="k-taps" aria-label={tapped >= 2 ? "Both tapped" : `${tapped} of 2 tapped`}>
          <span className="k-taps__dot" data-on={tapped >= 1} />
          <span className="k-taps__dot" data-on={tapped >= 2} />
        </div>
      </section>
    </Screen>
  );
}
