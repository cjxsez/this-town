/**
 * HikeGame.tsx (glasses-web): "Trail trivia", a five-question photo quiz about famous
 * hiking places around the world. Lives at /g/?hike (see main.tsx). No API or socket use: each rider answers
 * on their own lens, everyone gets the same questions in the same order, and they compare
 * out loud.
 *
 *   start     -> select starts the round
 *   question  -> a photo, a prompt and four options
 *   reveal    -> same screen with the right answer marked and the place named, for
 *                REVEAL_MS or until a tap
 *   done      -> score, what each photo was, and Restart (or Next game / Again in the playlist)
 *
 * With `split` it is "Split clue": one person sees the photo and describes it without the
 * words in `avoid`, the other picks the answer without seeing it. Each question gains a
 * step before the options:
 *
 *   describe  -> the photo and the words not to say; a tap (or the clock) moves on
 *   question  -> the four options, photo hidden
 *
 * For now both halves take turns on one lens: the wearer describes, taps, then reads the
 * options out and locks in the other person's pick. The real thing puts the photo on one
 * display and the options on another.
 *
 * Each question gets SECONDS_PER_QUESTION; when it runs out it counts as no answer. The
 * clock is unmounted during the reveal, so it cannot fire there.
 *
 * Input: the same as Guess who, built for the frame alone. Scrolling the temple strip walks
 * the four options in reading order (left/up = previous, right/down = next, stopping at
 * both ends), so one scroll axis reaches all of them. A tap selects.
 *
 * Wears the Guess who look (guess.css), plus hike.css for the photo, the option grid and
 * the reveal marks.
 */
import { useCallback, useEffect, useState } from "react";
import { Countdown, formatRemaining } from "../components/Countdown";
import { EndButtons } from "../components/EndButtons";
import { QUESTIONS, REVEAL_MS, ROUND_SIZE, SECONDS_PER_QUESTION, type HikeAnswer } from "../game/hike/questions";
import { useInput, type InputAction } from "../lib/input";
import { Wobble } from "./GuessGame";
import "../guess.css";
import "../hike.css";

type Step =
  | { name: "start" }
  | { name: "describe"; index: number; endsAt: number }
  | { name: "question"; index: number; endsAt: number }
  /** `left` is the time that was on the clock, `at` is when the reveal began. */
  | { name: "reveal"; index: number; picked: HikeAnswer; left: number; at: number }
  | { name: "done" };

const ROUND = QUESTIONS.slice(0, ROUND_SIZE);
/** A tap this soon after the reveal starts is the answering tap landing late: ignore it. */
const REVEAL_GUARD_MS = 350;

const deadline = () => Date.now() + SECONDS_PER_QUESTION * 1000;
/** -1 for the "previous" gestures, +1 for "next", 0 for anything else. */
const direction = (a: InputAction) => (a === "left" || a === "up" ? -1 : a === "right" || a === "down" ? 1 : 0);

/** `onNext` is set when the game runs in the /g/ playlist (Games.tsx). */
export function HikeGame({ split = false, onNext }: { split?: boolean; onNext?: () => void }) {
  const [step, setStep] = useState<Step>({ name: "start" });
  const [answers, setAnswers] = useState<HikeAnswer[]>([]);
  /** Focused option, 0 to 3 in reading order. */
  const [pick, setPick] = useState(0);

  const ask = useCallback((index: number) => {
    setPick(0);
    setStep({ name: "question", index, endsAt: deadline() });
  }, []);

  const show = useCallback(
    (index: number) => {
      if (!ROUND[index]) return setStep({ name: "done" });
      if (split) setStep({ name: "describe", index, endsAt: deadline() });
      else ask(index);
    },
    [split, ask],
  );

  const start = useCallback(() => {
    setAnswers([]);
    show(0);
  }, [show]);

  const answer = useCallback((index: number, picked: HikeAnswer, left: number) => {
    setAnswers((prev) => {
      const next = prev.slice(0, index);
      next[index] = picked;
      return next;
    });
    setStep({ name: "reveal", index, picked, left, at: Date.now() });
  }, []);

  const index = step.name === "describe" || step.name === "question" || step.name === "reveal" ? step.index : -1;
  const question = ROUND[index];
  const asking = step.name === "question";
  const describing = step.name === "describe";
  const onTimeUp = useCallback(() => answer(index, null, 0), [answer, index]);
  const onDescribed = useCallback(() => ask(index), [ask, index]);

  // The reveal moves on by itself.
  const revealing = step.name === "reveal";
  useEffect(() => {
    if (!revealing) return;
    const id = window.setTimeout(() => show(index + 1), REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [revealing, index, show]);

  useInput(
    (action) => {
      if (step.name === "done") return;
      if (step.name === "start") {
        if (action === "select") start();
        return;
      }
      if (step.name === "describe") {
        if (action === "select") ask(step.index);
        return;
      }
      if (step.name === "reveal") {
        if (action === "select" && Date.now() - step.at >= REVEAL_GUARD_MS) show(step.index + 1);
        return;
      }
      if (action === "select") {
        answer(step.index, pick, step.endsAt - Date.now());
        return;
      }
      const d = direction(action);
      if (d) setPick((p) => Math.min(3, Math.max(0, p + d)));
    },
    { pointer: true },
  );

  if (step.name === "start") {
    return (
      <main className="hud hud-center guess hike">
        <Wobble />
        <div className="guess-title">{split ? "Split clue" : "Trail trivia"}</div>
        <div className="guess-body">
          {split
            ? `You see the photo, they pick the answer. Describe ${ROUND.length} famous hikes without the banned words.`
            : `${ROUND.length} photos of famous hikes around the world. ${SECONDS_PER_QUESTION} seconds each.`}
        </div>
        <div className="guess-hint">{split ? "Tap when they are ready to guess" : "Scroll the frame to choose, tap to lock it in"}</div>
        <div className="guess-row">
          <div className="hud-btn guess-btn is-focused" role="button">
            Start
          </div>
        </div>
      </main>
    );
  }

  if (step.name === "done") {
    const score = ROUND.filter((q, i) => answers[i] === q.answer).length;
    return (
      <main className="hud guess hike hike-done">
        <Wobble />
        <div className="guess-title guess-title-sm">
          {score} of {ROUND.length} right
        </div>
        <div className="guess-list">
          {ROUND.map((q, i) => {
            const a = answers[i] ?? null;
            const mark = a === null ? "none" : a === q.answer ? "right" : "wrong";
            return (
              <div className="guess-line hike-line" key={q.id}>
                <span>{q.place}</span>
                <span className={`hike-mark is-${mark}`}>
                  {mark === "none" ? "No answer" : <Mark kind={mark} label={mark === "right" ? "Right" : "Wrong"} />}
                </span>
              </div>
            );
          })}
        </div>
        <div className="guess-hint">{split ? "Swap who describes, then go again" : "Compare scores, then go again"}</div>
        <EndButtons onAgain={start} onNext={onNext} />
      </main>
    );
  }

  if (!question) return null;

  const picked = step.name === "reveal" ? step.picked : null;
  const verdict = picked === null ? "Time's up" : picked === question.answer ? "Correct" : "Not quite";

  return (
    <main className={`hud guess hike ${step.name === "reveal" ? "is-reveal" : ""}`}>
      <Wobble />
      <div className="hike-top">
        {split && asking ? (
          <div className="hike-photo is-hidden">Photo hidden</div>
        ) : (
          <div className="hike-photo">
            <img src={question.photo} alt={question.alt} width={320} height={200} />
          </div>
        )}
        <div className="hike-side">
          <span className="guess-eyebrow">
            {index + 1} of {ROUND.length}
          </span>
          <div className="guess-steps" aria-hidden>
            {ROUND.map((q, i) => (
              <span key={q.id} className={`guess-step ${i <= index ? "is-on" : ""}`} />
            ))}
          </div>
          {step.name === "describe" ? (
            <Countdown key={`describe-${index}`} endsAt={step.endsAt} onDone={onDescribed} className="guess-clock hike-clock" />
          ) : step.name === "question" ? (
            <Countdown key={index} endsAt={step.endsAt} onDone={onTimeUp} className="guess-clock hike-clock" />
          ) : (
            <span className="countdown guess-clock hike-clock is-stopped">{formatRemaining(step.name === "reveal" ? step.left : 0)}</span>
          )}
        </div>
      </div>
      {describing ? (
        <>
          <div className="hike-prompt">Describe it. Don't say:</div>
          <div className="hike-avoid">
            {question.avoid.map((word) => (
              <span key={word} className="hike-word">
                {word}
              </span>
            ))}
          </div>
          <div className="guess-hint">Tap when they are ready to guess</div>
        </>
      ) : (
        <>
        {asking ? (
          <div className="hike-prompt">{question.prompt}</div>
        ) : (
          <div className="hike-prompt hike-place" role="status">
            <span className={`hike-verdict ${picked === question.answer ? "is-right" : "is-wrong"}`}>{verdict}</span>
            {question.place}
          </div>
        )}
        <div className="hike-options">
          {question.options.map((option, i) => {
            const state = asking
              ? pick === i
                ? "is-focused"
                : ""
              : i === question.answer
                ? "is-right"
                : i === picked
                  ? "is-wrong"
                  : "is-out";
            return (
              <div key={option} className={`hud-btn guess-btn hike-btn ${state}`} role="button" aria-pressed={asking ? pick === i : undefined}>
                {state === "is-right" && <Mark kind="right" label="Right answer" />}
                {state === "is-wrong" && <Mark kind="wrong" label="Your answer, wrong" />}
                <span>{option}</span>
              </div>
            );
          })}
        </div>
        <div className="guess-hint">{asking ? "Scroll to choose, tap to lock in" : "Tap for the next one"}</div>
        </>
      )}
    </main>
  );
}

/** A hand-drawn tick or cross. Drawn as strokes, since the display fonts have no such glyphs. */
function Mark({ kind, label }: { kind: "right" | "wrong"; label: string }) {
  return (
    <svg className="hike-icon" viewBox="0 0 24 24" role="img" aria-label={label}>
      <path d={kind === "right" ? "M3 13.5 9 20 21 4.5" : "M4.5 4 20 20.5M20.5 4.5 4 20"} />
    </svg>
  );
}
