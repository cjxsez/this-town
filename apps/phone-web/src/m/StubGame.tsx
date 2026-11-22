import type { GameProps, StubView } from "@questline/protocol/games";
import { Button, Hint, Screen, Title } from "../ui";
import { EndButtons } from "./EndButtons";

/** The screen for a placeholder game (protocol games/stub.ts). */
export function StubGame({ title, view, send, onNext, onAgain }: GameProps<StubView> & { title: string }) {
  if (view.phase === "done") {
    return (
      <Screen footer={<EndButtons onNext={onNext} onAgain={onAgain} />}>
        <Title size="md">{title}</Title>
        <Hint>Not built yet</Hint>
      </Screen>
    );
  }
  return (
    <Screen
      footer={
        <Button disabled={view.youReady} onClick={() => send({ type: "ready" })}>
          {view.youReady ? "Waiting for your partner" : "Start"}
        </Button>
      }
    >
      <Title>{title}</Title>
    </Screen>
  );
}
