/**
 * Mission.tsx (glasses-web): compact copy of the mission the kiosk screen is running.
 *
 * Driven by mission.start (Mission: title, prompt, endsAt, rare). Partner comes from the
 * earlier match.found. Leaves on mission.end / stamp.awarded (handled in App).
 * The kiosk screen is the main mission surface; this is a glanceable reminder.
 */
import type { Mission as MissionModel, Partner } from "@questline/protocol";
import { ColorSwatch } from "../components/ColorSwatch";
import { Countdown } from "../components/Countdown";

interface MissionProps {
  mission: MissionModel;
  partner: Partner | null;
  /** From stamp.progress: how many of the pair have tapped. */
  tapped?: 0 | 1 | 2;
}

export function Mission({ mission, partner, tapped = 0 }: MissionProps) {
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
      {tapped === 1 && (
        <div className="hud-warn" role="status" aria-live="polite">
          1 of 2 tapped
        </div>
      )}
      {tapped === 2 && (
        <div className="hud-dim" role="status" aria-live="polite">
          Both tapped
        </div>
      )}
    </main>
  );
}
