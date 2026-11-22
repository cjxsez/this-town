/**
 * TriviaGame.tsx (glasses-web): "Left for you" on the lens (protocol games/trivia.ts).
 *
 *   intro     select: ready
 *   question  up/left: previous choice, down/right: next, select: lock in. The highlight
 *             is shared with the other device, so the pair is choosing together.
 *   reveal    select: move on (it also moves on by itself)
 *   leave     the lens cannot type: it shows the prompt and what the partner is doing.
 *             select on Skip asks once more before skipping.
 *   writing   nothing to press
 *   result    the shared End buttons
 */
import { useState } from "react";
import { triviaFromLine, type GameProps, type TriviaView } from "@questline/protocol/games";
import { Clock } from "../../components/Clock";
import { EndButtons } from "../../components/EndButtons";
import { Wobble } from "../../components/Wobble";
import { useInput } from "../../lib/input";
import "./trivia.css";

const LETTERS = ["A", "B", "C", "D"];

function Choices({ choices, focus, right, wrong, small }: { choices: string[]; focus?: number; right?: number; wrong?: number | null; small?: boolean }) {
  return (
    <div className={`trivia-choices ${small ? "is-small" : ""}`}>
      {choices.map((choice, i) => (
        <div
          key={i}
          className={`trivia-choice ${i === focus ? "is-focused" : ""} ${i === right ? "is-right" : ""} ${i === wrong ? "is-wrong" : ""}`}
        >
          <span className="trivia-letter">{LETTERS[i]}</span>
          <span className="trivia-choice-text">{choice}</span>
        </div>
      ))}
    </div>
  );
}

const sizeOf = (q: string) => (q.length > 90 ? "is-long" : q.length > 55 ? "is-mid" : "");

export function TriviaGame({ view, send, serverNow, onNext, onAgain, last }: GameProps<TriviaView>) {
  /** Skip on the leave screen was pressed once and waits for a second press. */
  const [sure, setSure] = useState(0);

  useInput(
    (action) => {
      switch (view.phase) {
        case "intro":
          if (action === "select" && !view.youReady) send({ type: "ready" });
          return;
        case "question":
          if (action === "select") send({ type: "lock", q: view.index, choice: view.cursor });
          else if (action === "up" || action === "left") send({ type: "move", q: view.index, by: -1 });
          else if (action === "down" || action === "right") send({ type: "move", q: view.index, by: 1 });
          return;
        case "reveal":
          if (action === "select") send({ type: "next", q: view.index });
          return;
        case "leave":
          if (sure === 0) {
            if (action === "select") setSure(1);
          } else if (action === "select") {
            if (sure === 2) send({ type: "skip" });
            setSure(0);
          } else if (action === "left" || action === "up") setSure(1);
          else if (action === "right" || action === "down") setSure(2);
          return;
        default:
          return; // writing: nothing to press. result: EndButtons listens itself.
      }
    },
    { pointer: true },
  );

  if (view.phase === "intro") {
    return (
      <main className="hud hud-center guess trivia">
        <Wobble />
        <div className="guess-title">Left for you</div>
        <div className="guess-body">The last pair left you these. Answer them together.</div>
        <div className="guess-hint">{view.youReady ? "Waiting for your partner" : "Scroll to choose, tap to lock in"}</div>
        <div className="guess-row">
          <div className={`hud-btn guess-btn ${view.youReady ? "" : "is-focused"}`} role="button">
            {view.youReady ? "Ready" : "Start"}
          </div>
        </div>
      </main>
    );
  }

  if (view.phase === "question" || view.phase === "reveal") {
    const reveal = view.phase === "reveal";
    const verdict = !reveal ? "" : view.picked === null ? "Out of time" : view.picked === view.answer ? "Got it!" : "Not this time";
    return (
      <main className="hud guess trivia">
        <Wobble />
        <div className="guess-top">
          <div className="guess-progress">
            <span className="guess-eyebrow">
              {view.index + 1} of {view.total}
            </span>
            <span className="trivia-from">{triviaFromLine(view)}</span>
          </div>
          {reveal ? (
            <span className={`trivia-verdict ${view.picked === view.answer ? "is-right" : ""}`}>{verdict}</span>
          ) : (
            <Clock deadline={view.deadline} serverNow={serverNow} />
          )}
        </div>
        <div className={`trivia-q ${sizeOf(view.q)}`}>{view.q}</div>
        {reveal ? (
          <Choices choices={view.choices} right={view.answer} wrong={view.picked === view.answer ? null : view.picked} />
        ) : (
          <Choices choices={view.choices} focus={view.cursor} />
        )}
      </main>
    );
  }

  if (view.phase === "leave") {
    return (
      <main className="hud hud-center guess trivia">
        <Wobble />
        <div className="guess-top trivia-wide">
          <span className="guess-eyebrow">Leave one</span>
          <Clock deadline={view.deadline} serverNow={serverNow} />
        </div>
        <div className="guess-body">
          {view.retry ? "That one can't be left. Try another about the T or Boston." : "Now leave a question for the next pair. Make it about the T or Boston."}
        </div>
        <div className="guess-hint">{view.writer === "partner" ? "Your partner is writing..." : "Tell your partner what to ask"}</div>
        {sure === 0 ? (
          <div className="guess-row">
            <div className="hud-btn guess-btn is-focused" role="button">
              Skip
            </div>
          </div>
        ) : (
          <div className="guess-row trivia-wide">
            {["Keep going", "Skip it"].map((label, i) => (
              <div key={label} className={`hud-btn guess-btn ${sure === i + 1 ? "is-focused" : ""}`} role="button">
                {label}
              </div>
            ))}
          </div>
        )}
      </main>
    );
  }

  if (view.phase === "writing") {
    return (
      <main className="hud hud-center guess trivia">
        <Wobble />
        <div className="guess-eyebrow">Your question</div>
        <div className={`guess-card trivia-card ${sizeOf(view.q)}`}>{view.q}</div>
        <div className="guess-body">Answer: {view.a}</div>
        <div className="guess-hint trivia-pulse">Writing the wrong answers...</div>
      </main>
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
    <main className="hud guess trivia">
      <Wobble />
      <div className="guess-title guess-title-sm trivia-headline">{headline}</div>
      {view.card ? (
        <>
          <div className={`trivia-q is-result ${sizeOf(view.card.q)}`}>{view.card.q}</div>
          <Choices choices={view.card.choices} right={view.card.answer} small />
        </>
      ) : view.outcome === "failed" && view.draft ? (
        <div className={`trivia-q is-result ${sizeOf(view.draft.q)}`}>{view.draft.q}</div>
      ) : null}
      <div className="guess-hint">
        You two got {view.score} of {view.total}
      </div>
      <EndButtons onAgain={onAgain} onNext={onNext} last={last} />
    </main>
  );
}
