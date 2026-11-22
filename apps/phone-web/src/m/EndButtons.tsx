import { Button, ButtonRow } from "../ui";

/**
 * The two buttons on a game's last screen. Either player can press; both move. After the last
 * game of the playlist (`last`) there is one: Finish, which ends the room (onNext).
 */
export function EndButtons({ onNext, onAgain, last }: { onNext: () => void; onAgain: () => void; last?: boolean }) {
  if (last) {
    return (
      <ButtonRow>
        <Button onClick={onNext}>Finish</Button>
      </ButtonRow>
    );
  }
  return (
    <ButtonRow>
      <Button variant="secondary" onClick={onAgain}>
        Again
      </Button>
      <Button onClick={onNext}>Next game</Button>
    </ButtonRow>
  );
}
