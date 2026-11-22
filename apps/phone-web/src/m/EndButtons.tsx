import type { EndChoice, EndVotes } from "@questline/protocol/games";
import { Button, ButtonRow, Hint } from "../ui";

const LABEL: Record<EndChoice, string> = { next: "Next game", again: "Again", finish: "Finish" };

/** The line under the buttons: who is waiting for whom. */
function voteLine(votes: EndVotes | undefined): string {
  const you = votes?.you ?? null;
  const partner = votes?.partner ?? null;
  if (you && partner && you !== partner) return `Your partner picked ${LABEL[partner]}. Pick the same to go on.`;
  if (you) return "Waiting for your partner to pick too.";
  if (partner) return `Your partner picked ${LABEL[partner]}.`;
  return "You both pick to go on.";
}

/**
 * The buttons on a game's last screen. They are votes: the room only moves once both
 * players picked the same (RoomView.votes), so one player can't push the other on. Your pick
 * shows a tick; the line under says who you are waiting for. After the last game of the
 * playlist (`last`) there is one: Finish (onNext), which also happens by itself after 20 s.
 */
export function EndButtons({
  onNext,
  onAgain,
  last,
  votes,
}: {
  onNext: () => void;
  onAgain: () => void;
  last?: boolean;
  votes?: EndVotes;
}) {
  const mine = votes?.you ?? null;
  const hint = <Hint style={{ textAlign: "center", margin: "0 0 6px" }}>{voteLine(votes)}</Hint>;
  if (last) {
    return (
      <>
        {hint}
        <ButtonRow>
          <Button onClick={onNext} aria-pressed={mine === "finish"}>
            {mine === "finish" ? "✓ Finish" : "Finish"}
          </Button>
        </ButtonRow>
      </>
    );
  }
  return (
    <>
      {hint}
      <ButtonRow>
        <Button variant="secondary" onClick={onAgain} aria-pressed={mine === "again"}>
          {mine === "again" ? "✓ Again" : "Again"}
        </Button>
        <Button onClick={onNext} aria-pressed={mine === "next"}>
          {mine === "next" ? "✓ Next game" : "Next game"}
        </Button>
      </ButtonRow>
    </>
  );
}
