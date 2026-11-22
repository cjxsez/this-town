/**
 * GamesOver.tsx (glasses-web): the end of the playlist (RoomView.finished). All three games
 * are played; nothing restarts the room. A matched rider's ride HUD moves on to the stamp
 * when it arrives from the worker (D28).
 */
import { Wobble } from "../components/Wobble";

export function GamesOver() {
  return (
    <main className="hud hud-center guess">
      <Wobble />
      <div className="guess-eyebrow">That's all three</div>
      <div className="guess-title">Thanks for playing</div>
      <div className="guess-body">Tall tale, First impressions and Left for you. Your question is waiting for the next pair.</div>
    </main>
  );
}
