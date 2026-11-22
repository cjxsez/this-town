import { Button, ButtonRow } from "../ui";

/** The two buttons on a game's last screen. Either player can press; both move. */
export function EndButtons({ onNext, onAgain }: { onNext: () => void; onAgain: () => void }) {
  return (
    <ButtonRow>
      <Button variant="secondary" onClick={onAgain}>
        Again
      </Button>
      <Button onClick={onNext}>Next game</Button>
    </ButtonRow>
  );
}
