/**
 * Mission.tsx (kiosk-web): the shared mission, the main surface while a pair plays.
 *
 * Driven by mission.show: color (accent bar), mission.title, mission.prompt,
 * mission.endsAt (big countdown), mission.rare. First names come from the earlier
 * pair.incoming for the same matchId (mission.show does not repeat them).
 * Footer: "Tap the tag to stamp". The Pi rewrites the tag with a fresh nonce on nfc.write;
 * both riders tapping it is what earns the stamp (decision D8).
 * Leaves on celebrate (-> Celebrate) or pair.cleared (-> Idle).
 *
 * Public screen: the prompt is a curated deck mission (never personal), names are first
 * names only.
 *
 * TODO:
 * - At 0:00 show "Time's up" until pair.cleared arrives.
 * - Show "1 of 2 tapped" if the worker ever sends stamp progress to kiosks (no event yet).
 */
import { PAIR_COLOR_HEX, type Mission as MissionModel, type PairColor } from "@questline/protocol";
import { Countdown } from "../components/Countdown";
import { NfcHint } from "../components/NfcHint";

interface MissionProps {
  color: PairColor;
  mission: MissionModel;
  firstNames: [string, string] | null;
}

export function Mission({ color, mission, firstNames }: MissionProps) {
  const hex = PAIR_COLOR_HEX[color];
  return (
    <main className="screen mission" style={{ borderColor: hex }}>
      <header className="mission-top">
        <span className="mission-names" style={{ color: hex }}>
          {firstNames ? `${firstNames[0]} & ${firstNames[1]}` : "Mission"}
        </span>
        {mission.rare && <span className="mission-rare">Rare</span>}
      </header>
      <div className="mission-body">
        <div className="mission-text">
          <h1 className="mission-title">{mission.title}</h1>
          <p className="mission-prompt">{mission.prompt}</p>
        </div>
        <Countdown endsAt={mission.endsAt} className="countdown-lg" />
      </div>
      <NfcHint label="Tap the tag to stamp" size={56} />
    </main>
  );
}
