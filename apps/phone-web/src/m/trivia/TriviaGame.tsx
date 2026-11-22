import { useState } from "react";
import {
  TRIVIA_MAX_ANSWER,
  TRIVIA_MAX_QUESTION,
  TRIVIA_MIN_QUESTION,
  triviaFromLine,
  type GameProps,
  type TriviaView,
} from "@questline/protocol/games";
import { Body, Button, Card, Eyebrow, Hint, Screen, TextField, TextLink, Title } from "../../ui";
import { Clock } from "../Clock";
import { EndButtons } from "../EndButtons";
import "./trivia.css";

const LETTERS = ["A", "B", "C", "D"];

/**
 * "Left for you" on the phone (protocol games/trivia.ts). Three questions answered as a
 * team: tapping a choice moves the highlight on both devices and "Lock in" answers for the
 * pair. Then this screen has the form for the question the pair leaves behind (the glasses
 * cannot type).
 */
export function TriviaGame({ view, send, serverNow, onNext, onAgain }: GameProps<TriviaView>) {
  // The form lives up here so the text is still there if the question has to be rewritten.
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [typing, setTyping] = useState(false);

  const typed = (set: (v: string) => void) => (value: string) => {
    set(value);
    if (!typing) {
      setTyping(true);
      send({ type: "typing" });
    }
  };

  if (view.phase === "intro") {
    return (
      <Screen
        label="M-trivia-intro"
        footer={
          <Button disabled={view.youReady} onClick={() => send({ type: "ready" })}>
            {view.youReady ? "Waiting for your partner" : "Start"}
          </Button>
        }
      >
        <Eyebrow>Game 3</Eyebrow>
        <Title>Left for you</Title>
        <Body>The last pair left you these. {view.total} questions, answered together.</Body>
        <Hint>Talk it over out loud. Either of you can lock in the answer.</Hint>
      </Screen>
    );
  }

  if (view.phase === "question" || view.phase === "reveal") {
    const reveal = view.phase === "reveal";
    const got = reveal && view.picked === view.answer;
    return (
      <Screen
        label={`M-trivia-${view.phase}`}
        blobs="b"
        footer={
          reveal ? (
            <Button onClick={() => send({ type: "next", q: view.index })}>{view.index + 1 < view.total ? "Next question" : "Keep going"}</Button>
          ) : (
            <Button onClick={() => send({ type: "lock", q: view.index, choice: view.cursor })}>Lock in {LETTERS[view.cursor]}</Button>
          )
        }
      >
        <div className="trivia-top">
          <div>
            <Eyebrow>
              {view.index + 1} of {view.total}
            </Eyebrow>
            <div className="trivia-from">{triviaFromLine(view)}</div>
          </div>
          {reveal ? (
            <span className={`trivia-verdict ${got ? "is-right" : ""}`}>{view.picked === null ? "Out of time" : got ? "Got it!" : "Not this time"}</span>
          ) : (
            <Clock deadline={view.deadline} serverNow={serverNow} />
          )}
        </div>
        <Card className="trivia-q">{view.q}</Card>
        <div className="trivia-choices">
          {view.choices.map((choice, i) => {
            const state = reveal
              ? i === view.answer
                ? "is-right"
                : i === view.picked
                  ? "is-wrong"
                  : "is-dim"
              : i === view.cursor
                ? "is-on"
                : "";
            return (
              <button
                key={i}
                type="button"
                className={`trivia-choice ${state}`}
                disabled={reveal}
                aria-pressed={!reveal && i === view.cursor}
                onClick={() => send({ type: "move", q: view.index, to: i })}
              >
                <span className="trivia-letter">{LETTERS[i]}</span>
                <span>{choice}</span>
              </button>
            );
          })}
        </div>
        {!reveal && <Hint>Tap to point at one. You both see it.</Hint>}
      </Screen>
    );
  }

  if (view.phase === "leave") {
    const q = question.trim();
    const a = answer.trim();
    const ok = q.length >= TRIVIA_MIN_QUESTION && a.length > 0;
    return (
      <Screen
        label="M-trivia-leave"
        blobs="c"
        footer={
          <>
            <Button disabled={!ok} onClick={() => send({ type: "leave", question: q, answer: a })}>
              Leave it
            </Button>
            <TextLink small onClick={() => send({ type: "skip" })}>
              Skip
            </TextLink>
          </>
        }
      >
        <div className="trivia-top">
          <Eyebrow>Leave one</Eyebrow>
          <Clock deadline={view.deadline} serverNow={serverNow} />
        </div>
        <Title size="md">Leave a question for the next pair</Title>
        {view.retry ? (
          <Body>That one can't be left. Try another about the T or Boston.</Body>
        ) : (
          <Body>Make it about the T or Boston. Decide together, then type it here.</Body>
        )}
        <label className="q-field trivia-area">
          <textarea
            aria-label="Your question"
            value={question}
            placeholder="Which station has..."
            maxLength={TRIVIA_MAX_QUESTION}
            rows={3}
            spellCheck={false}
            onChange={(e) => typed(setQuestion)(e.target.value.replace(/\n/g, " "))}
          />
        </label>
        <div className="trivia-count">
          {question.length}/{TRIVIA_MAX_QUESTION}
        </div>
        <TextField label="The right answer" value={answer} onChange={typed(setAnswer)} placeholder="The right answer" maxLength={TRIVIA_MAX_ANSWER} />
        <Hint>{view.writer === "partner" ? "Your partner is writing too. Whoever sends first wins." : "We'll write three wrong answers for you."}</Hint>
      </Screen>
    );
  }

  if (view.phase === "writing") {
    return (
      <Screen label="M-trivia-writing" blobs="c">
        <Eyebrow>Your question</Eyebrow>
        <Card className="trivia-q">{view.q}</Card>
        <Body>Answer: {view.a}</Body>
        <Title size="sm">Writing the wrong answers...</Title>
      </Screen>
    );
  }

  const headline =
    view.outcome === "saved"
      ? "Saved for the next pair"
      : view.outcome === "rejected"
        ? "That one can't be left"
        : view.outcome === "failed"
          ? "Couldn't save it this time"
          : "Nothing left this time";
  return (
    <Screen label="M-trivia-result" footer={<EndButtons onNext={onNext} onAgain={onAgain} />}>
      <Eyebrow>
        You two got {view.score} of {view.total}
      </Eyebrow>
      <Title size="md">{headline}</Title>
      {view.card ? (
        <>
          <Card className="trivia-q">{view.card.q}</Card>
          <div className="trivia-choices">
            {view.card.choices.map((choice, i) => (
              <div key={i} className={`trivia-choice is-static ${i === view.card!.answer ? "is-right" : "is-dim"}`}>
                <span className="trivia-letter">{LETTERS[i]}</span>
                <span>{choice}</span>
              </div>
            ))}
          </div>
          <Hint>The next pair to play gets this one first.</Hint>
        </>
      ) : view.outcome === "failed" && view.draft ? (
        <>
          <Card className="trivia-q">{view.draft.q}</Card>
          <Hint>The wrong answers didn't get written, so it wasn't kept. Play again to have another go.</Hint>
        </>
      ) : view.outcome === "rejected" ? (
        <Hint>Questions have to be about the T or Boston, and kind.</Hint>
      ) : (
        <Hint>Play again if you think of a good one.</Hint>
      )}
    </Screen>
  );
}
