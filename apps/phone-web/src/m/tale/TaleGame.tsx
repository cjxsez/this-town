import { useState } from "react";
import type { GameProps, TaleCard, TaleResult, TaleView } from "@questline/protocol/games";
import { Body, Button, ButtonRow, Card, Eyebrow, Hint, Screen, Title } from "../../ui";
import { Clock } from "../Clock";
import { EndButtons } from "../EndButtons";
import { useOpensAt } from "../room";
import "./tale.css";

/**
 * "Tall tale" on the phone (protocol games/tale.ts): tell your worst T story, which may be
 * made up, then call your partner's story true or made up.
 *
 * The partner sits next to this screen, so the secret card is never left showing: it sits
 * behind a hold-to-peek and hides again on release.
 */

const CARD_TITLE: Record<TaleCard, string> = { truth: "Tell the truth", fake: "Make it up" };
const CARD_WORD: Record<TaleCard, string> = { truth: "True", fake: "Made up" };
const SPARK_LEAD: Record<TaleCard, string> = { truth: "Think of", fake: "Try" };

export function TaleGame({ view, send, serverNow, onNext, onAgain, last }: GameProps<TaleView>) {
  // Done and the calls only count after the leftover-tap guard; until then the buttons are off.
  const open = useOpensAt(view.phase === "tell" || view.phase === "verdict" ? view.opensAt : null, serverNow);
  const [peeked, setPeeked] = useState(false);

  if (view.phase === "intro") {
    return (
      <Screen
        label="M-tale-intro"
        footer={
          <Button disabled={view.youReady} onClick={() => send({ type: "ready", phase: "intro" })}>
            {view.youReady ? "Waiting for your partner" : "Start"}
          </Button>
        }
      >
        <Eyebrow>In This Town games</Eyebrow>
        <Title>Tall tale</Title>
        <Body>Tell your worst T story. It might be made up.</Body>
        <Hint>You each get a secret card: tell the truth, or make it up. Then guess if your partner's story is true.</Hint>
      </Screen>
    );
  }

  if (view.phase === "think") {
    return (
      <Screen
        label="M-tale-think"
        blobs="b"
        footer={
          <Button disabled={view.youReady || !peeked} onClick={() => send({ type: "ready", phase: "think" })}>
            {view.youReady ? "Waiting for your partner" : peeked ? "Ready" : "Peek first"}
          </Button>
        }
      >
        <div className="tale-top">
          <Eyebrow>Your secret card</Eyebrow>
          <Clock deadline={view.deadline} serverNow={serverNow} />
        </div>
        <Title size="md">Your worst ride on the T</Title>
        <Peek card={view.card} spark={view.spark} onPeek={() => setPeeked(true)} />
        <Hint>Tilt the phone away from your partner, then hold the card.</Hint>
      </Screen>
    );
  }

  if (view.phase === "tell") {
    if (!view.telling) {
      return (
        <Screen label="M-tale-listen" blobs="c">
          <div className="tale-top">
            <Eyebrow>Their story</Eyebrow>
            <Clock deadline={view.deadline} serverNow={serverNow} />
          </div>
          <Title>Listen. Ask questions.</Title>
          <Body>Is it true, or made up?</Body>
          <Hint>{view.turn === 0 ? "You tell yours next." : "Then you both decide."}</Hint>
        </Screen>
      );
    }
    return (
      <Screen
        label="M-tale-tell"
        blobs="b"
        footer={
          <Button disabled={!open} onClick={() => send({ type: "done", turn: view.turn })}>
            Done
          </Button>
        }
      >
        <div className="tale-top">
          <Eyebrow>Your turn</Eyebrow>
          <Clock deadline={view.deadline} serverNow={serverNow} />
        </div>
        <Title>Tell your story.</Title>
        {view.card && view.spark && <Peek card={view.card} spark={view.spark} />}
        <Hint>Keep a straight face. Tap Done when you finish.</Hint>
      </Screen>
    );
  }

  if (view.phase === "verdict") {
    const called = view.yourCall !== null;
    return (
      <Screen
        label="M-tale-verdict"
        blobs="c"
        footer={
          called ? undefined : (
            <ButtonRow>
              <Button huge variant="leaf" disabled={!open} onClick={() => send({ type: "call", call: "truth" })}>
                True
              </Button>
              <Button huge disabled={!open} onClick={() => send({ type: "call", call: "fake" })}>
                Made up
              </Button>
            </ButtonRow>
          )
        }
      >
        <div className="tale-top">
          <Eyebrow>Your call</Eyebrow>
          <Clock deadline={view.deadline} serverNow={serverNow} />
        </div>
        <Title>Your partner's story was...</Title>
        {view.yourCall !== null ? (
          <>
            <Card className="tale-locked">
              <Eyebrow>You said</Eyebrow>
              <div className="tale-word">{CARD_WORD[view.yourCall]}</div>
            </Card>
            <Hint>Locked in. Waiting for your partner.</Hint>
          </>
        ) : (
          <Hint>{view.theyCalled ? "Your partner has decided." : "No peeking at each other."}</Hint>
        )}
      </Screen>
    );
  }

  return (
    <Screen label="M-tale-reveal" footer={<EndButtons onNext={onNext} onAgain={onAgain} last={last} />}>
      <Eyebrow>Tall tale</Eyebrow>
      <Title size="md">{view.summary}</Title>
      <Story label="Your story" result={view.yours} />
      <Story label="Their story" result={view.theirs} />
      <Card ink tight className="tale-score">
        <span>
          You <b>{view.youPoints}</b>
        </span>
        <span>
          Partner <b>{view.theyPoints}</b>
        </span>
      </Card>
    </Screen>
  );
}

/** The secret card, face down until held. */
function Peek({ card, spark, onPeek }: { card: TaleCard; spark: string; onPeek?: () => void }) {
  const [open, setOpen] = useState(false);
  const show = () => {
    setOpen(true);
    onPeek?.();
  };
  const hide = () => setOpen(false);
  return (
    <button
      type="button"
      className={`q-card tale-peek ${open ? "is-open" : ""}`}
      aria-label="Hold to peek at your secret card"
      onPointerDown={show}
      onPointerUp={hide}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && show()}
      onKeyUp={hide}
      onBlur={hide}
      onContextMenu={(e) => e.preventDefault()}
    >
      {open ? (
        <>
          <span className="tale-peek-title">{CARD_TITLE[card]}</span>
          <span className="tale-peek-spark">
            {SPARK_LEAD[card]}: {spark}
          </span>
        </>
      ) : (
        <>
          <span className="tale-peek-title">Hold to peek</span>
          <span className="tale-peek-spark">Your secret card</span>
        </>
      )}
    </button>
  );
}

function Story({ label, result }: { label: string; result: TaleResult }) {
  return (
    <Card tight className="tale-story">
      <div className="tale-story-head">
        <Eyebrow>{label}</Eyebrow>
        <span className={`tale-tag is-${result.card}`}>{CARD_WORD[result.card]}</span>
      </div>
      <div className="tale-story-note">
        {result.note}
        {result.point && <b className="tale-plus">+1</b>}
      </div>
    </Card>
  );
}
