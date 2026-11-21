/**
 * GuessGame.tsx (glasses-web): "Guess who", a five-question guessing game about the person
 * in front of you. Lives at the /g/ root (see main.tsx). No API or socket use: the wearer
 * guesses on the lens, then the two of them talk through the answers out loud.
 *
 *   start   -> select starts the round
 *   either  -> two options, trivia style
 *   scale   -> 0 to 10
 *   done    -> the wearer's guesses, and a Restart button
 *
 * Each question gets SECONDS_PER_QUESTION; when it runs out the question is skipped.
 *
 * Input: built for the frame alone, no Neural Band. Scrolling the temple strip moves the
 * choice (either direction pair works: left/up = previous, right/down = next) and a tap
 * selects. Scroll and tap are also read as wheel and click events (useInput pointer mode),
 * in case the strip sends those instead of keys.
 */
import { useCallback, useState } from "react";
import { Countdown } from "../components/Countdown";
import { QUESTIONS, ROUND_SIZE, SECONDS_PER_QUESTION, type Answer, type Question } from "../game/questions";
import { useInput, type InputAction } from "../lib/input";

type Step = { name: "start" } | { name: "question"; index: number; endsAt: number } | { name: "done" };

const ROUND = QUESTIONS.slice(0, ROUND_SIZE);
const SCALE_START = 5;

const deadline = () => Date.now() + SECONDS_PER_QUESTION * 1000;
/** -1 for the "previous" gestures, +1 for "next", 0 for anything else. */
const direction = (a: InputAction) => (a === "left" || a === "up" ? -1 : a === "right" || a === "down" ? 1 : 0);

export function GuessGame() {
  const [step, setStep] = useState<Step>({ name: "start" });
  const [answers, setAnswers] = useState<Answer[]>([]);
  /** Focused option (0 or 1) on an either question, the number on a scale question. */
  const [pick, setPick] = useState(0);

  const show = useCallback((index: number) => {
    const q = ROUND[index];
    if (!q) return setStep({ name: "done" });
    setPick(q.kind === "scale" ? SCALE_START : 0);
    setStep({ name: "question", index, endsAt: deadline() });
  }, []);

  const start = useCallback(() => {
    setAnswers([]);
    show(0);
  }, [show]);

  const answer = useCallback(
    (index: number, value: Answer) => {
      setAnswers((prev) => {
        const next = prev.slice(0, index);
        next[index] = value;
        return next;
      });
      show(index + 1);
    },
    [show],
  );

  const question = step.name === "question" ? ROUND[step.index] : undefined;
  const index = step.name === "question" ? step.index : -1;
  const onTimeUp = useCallback(() => answer(index, null), [answer, index]);

  useInput(
    (action) => {
      if (!question) {
        if (action === "select") start();
        return;
      }
      if (action === "select") {
        answer(index, question.kind === "scale" ? pick : question.options[pick] ?? null);
        return;
      }
      const d = direction(action);
      if (!d) return;
      if (question.kind === "scale") setPick((p) => Math.min(10, Math.max(0, p + d)));
      else setPick(d < 0 ? 0 : 1);
    },
    { pointer: true },
  );

  if (step.name === "start") {
    return (
      <main className="hud hud-center">
        <div className="hud-title">Guess who</div>
        <div className="hud-body">
          {ROUND.length} quick guesses about the person in front of you. {SECONDS_PER_QUESTION} seconds each.
        </div>
        <div className="hud-hint">Scroll the frame to choose, tap to lock it in</div>
        <div className="hud-row">
          <div className="hud-btn is-focused" role="button">
            Start
          </div>
        </div>
      </main>
    );
  }

  if (step.name === "done") {
    return (
      <main className="hud">
        <div className="hud-title">Your guesses</div>
        <div className="guess-list">
          {ROUND.map((q, i) => (
            <div className="guess-line" key={q.id}>
              <span className="hud-dim">{label(q)}</span>
              <span className="hud-strong">{formatAnswer(q, answers[i] ?? null)}</span>
            </div>
          ))}
        </div>
        <div className="hud-hint">Ask them how you did</div>
        <div className="hud-row">
          <div className="hud-btn is-focused" role="button">
            Restart
          </div>
        </div>
      </main>
    );
  }

  if (!question) return null;

  return (
    <main className="hud">
      <div className="hud-row hud-row-between">
        <span className="hud-dim">
          {step.index + 1} of {ROUND.length}
        </span>
        <Countdown key={step.index} endsAt={step.endsAt} onDone={onTimeUp} className="countdown-md" />
      </div>
      <div className="hud-body hud-strong">{question.prompt}</div>
      {question.kind === "either" ? (
        <div className="hud-row">
          {question.options.map((option, i) => (
            <div key={option} className={`hud-btn ${pick === i ? "is-focused" : ""}`} role="button" aria-pressed={pick === i}>
              {option}
            </div>
          ))}
        </div>
      ) : (
        <div className="scale" role="slider" aria-valuemin={0} aria-valuemax={10} aria-valuenow={pick}>
          <div className="scale-value">{pick}</div>
          <div className="scale-track">
            {Array.from({ length: 11 }, (_, n) => (
              <span key={n} className={`scale-tick ${n === pick ? "is-focused" : n < pick ? "is-under" : ""}`} />
            ))}
          </div>
          <div className="hud-row hud-row-between hud-dim">
            <span>0 · {question.low}</span>
            <span>{question.high} · 10</span>
          </div>
        </div>
      )}
      <div className="hud-hint">Scroll to choose, tap to lock in</div>
    </main>
  );
}

/** Short name for the recap line. */
function label(q: Question): string {
  return q.kind === "either" ? q.options.join(" / ") : q.short;
}

function formatAnswer(q: Question, a: Answer): string {
  if (a === null) return "No guess";
  return q.kind === "scale" ? `${a} / 10` : String(a);
}
