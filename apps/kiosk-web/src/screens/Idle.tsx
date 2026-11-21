/**
 * Idle.tsx (kiosk-web): the default screen, readable from across the car.
 *
 * Driven by kiosk.idle: ridersInCar, ridersOnTrain, nextStop, nextStopEtaSec (shown as a
 * countdown). Big "Tap to play" with the NFC icon: tapping the tag with a phone opens
 * /k/<car> on phone-web and checks the rider in.
 *
 * Public screen: counts only, no names here.
 *
 * TODO:
 * - Touch anywhere: show a 10 s "How it works" overlay (the screen is a touchscreen but
 *   nothing on it needs touch today).
 * - Attract loop (subtle animation) so the screen does not look frozen.
 */
import type { ServerToKiosk } from "@questline/protocol";
import { Countdown } from "../components/Countdown";
import { NfcHint } from "../components/NfcHint";

export type IdleStats = Omit<Extract<ServerToKiosk, { type: "kiosk.idle" }>, "type" | "serverNow">;

interface IdleProps {
  car: string;
  stats: IdleStats | null;
  /** Epoch ms of the next stop, computed when kiosk.idle arrived. */
  nextStopAt: number | null;
}

export function Idle({ car, stats, nextStopAt }: IdleProps) {
  return (
    <main className="screen idle">
      <header className="idle-top">
        <div className="idle-stat">
          <span className="idle-num">{stats?.ridersInCar ?? "–"}</span>
          <span className="idle-cap">in this car</span>
        </div>
        <div className="idle-stat">
          <span className="idle-num">{stats?.ridersOnTrain ?? "–"}</span>
          <span className="idle-cap">on this train</span>
        </div>
        <div className="idle-stat idle-next">
          <span className="idle-cap">Next stop</span>
          <span className="idle-stop">{stats?.nextStop ?? "…"}</span>
          {nextStopAt !== null && <Countdown endsAt={nextStopAt} className="countdown-sm" />}
        </div>
      </header>
      <NfcHint label="Tap to play" size={96} />
      <footer className="screen-foot">Questline · car {car}</footer>
    </main>
  );
}
