/**
 * Mission.tsx (glasses-web): compact copy of the mission the kiosk screen is running.
 *
 * Driven by mission.start (Mission: title, prompt, endsAt, rare). Partner comes from the
 * earlier match.found. Leaves on mission.end / stamp.awarded (handled in App).
 * The kiosk screen is the main mission surface; this is a glanceable reminder.
 *
 * TODO:
 * - Rare badge styling.
 * - "Tap the tag to stamp" hint in the last 30 s.
 * - Decide what back does here (see lib/input.ts TODO).
 */
import type { Mission as MissionModel, Partner } from "@questline/protocol";
import { ColorSwatch } from "../components/ColorSwatch";
import { Countdown } from "../components/Countdown";

interface MissionProps {
  mission: MissionModel;
  partner: Partner | null;
}

export function Mission({ mission, partner }: MissionProps) {
  return (
    <main className="hud">
      <div className="hud-row hud-row-between">
        {partner ? <ColorSwatch color={partner.color} size={40} showLabel={false} /> : <span />}
        <Countdown endsAt={mission.endsAt} className="countdown-md" />
      </div>
      <div className="hud-title">
        {mission.rare && <span className="hud-rare">Rare · </span>}
        {mission.title}
      </div>
      <div className="hud-body">{mission.prompt}</div>
      {partner && <div className="hud-dim">with {partner.firstName}</div>}
    </main>
  );
}
