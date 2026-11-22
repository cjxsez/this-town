/**
 * ImpressionsGame.tsx (glasses-web): "First impressions" on the lens (protocol
 * games/impressions.ts).
 *
 *   intro  select: ready
 *   guess  left/up and right/down (or wheel) move the slider one position, select locks it in
 *   talk   shows the partner's guess about you; left/right move between Spot on / Close / Way off, select picks (can be changed)
 *   done   EndButtons
 */
import { useState } from "react";
import {
  IMPRESSIONS_RATING_LABEL,
  IMPRESSIONS_VERDICT_LABEL,
  impressionsRatings,
  impressionsSnap,
  impressionsUnit,
  impressionsValue,
  type GameProps,
  type ImpressionsTally,
  type ImpressionsView,
} from "@questline/protocol/games";
import { Clock } from "../../components/Clock";
import { EndButtons } from "../../components/EndButtons";
import { Wobble } from "../../components/Wobble";
import { useInput, type InputAction } from "../../lib/input";
import "./impressions.css";

type Props = GameProps<ImpressionsView>;
type Of<P extends ImpressionsView["phase"]> = Extract<ImpressionsView, { phase: P }>;

/** -1 for the "previous" gestures, +1 for "next", 0 for anything else. */
const direction = (a: InputAction) => (a === "left" || a === "up" ? -1 : a === "right" || a === "down" ? 1 : 0);

export function ImpressionsGame(props: Props) {
  const { view } = props;
  if (view.phase === "intro") return <Intro {...props} view={view} />;
  if (view.phase === "guess") return <Guess key={view.round} {...props} view={view} />;
  if (view.phase === "talk") return <Talk key={view.round} {...props} view={view} />;
  return <Done {...props} view={view} />;
}

function Intro({ view, send }: Props & { view: Of<"intro"> }) {
  useInput(
    (action) => {
      if (action === "select" && !view.youReady) send({ type: "ready" });
    },
    { pointer: true },
  );
  return (
    <main className="hud hud-center guess guess-start">
      <Wobble />
      <div className="guess-title">First impressions</div>
      <div className="guess-body">Guess your partner from first impressions. No asking yet.</div>
      <div className="guess-hint">{view.youReady ? "Waiting for your partner" : view.theyReady ? "Your partner is ready" : `${view.rounds} quick rounds`}</div>
      <div className="guess-row">
        <div className={`hud-btn guess-btn ${view.youReady ? "" : "is-focused"}`} role="button">
          {view.youReady ? "Ready" : "Start"}
        </div>
      </div>
    </main>
  );
}

function Top({ round, rounds, deadline, serverNow }: { round: number; rounds: number; deadline: number; serverNow: () => number }) {
  return (
    <div className="guess-top">
      <div className="guess-progress">
        <span className="guess-eyebrow">
          {round + 1} of {rounds}
        </span>
        <div className="guess-steps" aria-hidden>
          {Array.from({ length: rounds }, (_, i) => (
            <span key={i} className={`guess-step ${i <= round ? "is-on" : ""}`} />
          ))}
        </div>
      </div>
      <Clock deadline={deadline} serverNow={serverNow} />
    </div>
  );
}

function Guess({ view, send, serverNow }: Props & { view: Of<"guess"> }) {
  const q = view.question;
  const [pick, setPick] = useState(view.yourValue);
  const value = view.youLocked ? view.yourValue : pick;

  useInput(
    (action) => {
      if (view.youLocked) return;
      if (action === "select") return send({ type: "lock", value: pick });
      const d = direction(action);
      if (!d) return;
      const next = impressionsSnap(q, pick + d * q.step);
      if (next === pick) return;
      setPick(next);
      send({ type: "slide", value: next });
    },
    { pointer: true },
  );

  const ticks = Math.round((q.max - q.min) / q.step) + 1;
  const at = Math.round((value - q.min) / q.step);

  return (
    <main className="hud guess impressions">
      <Wobble />
      <Top round={view.round} rounds={view.rounds} deadline={view.deadline} serverNow={serverNow} />
      <div className="guess-card impressions-card">{q.prompt}</div>
      <div className={`scale ${view.youLocked ? "impressions-locked" : ""}`} role="slider" aria-valuemin={q.min} aria-valuemax={q.max} aria-valuenow={value}>
        {q.either ? (
          <div className="guess-row">
            {[q.min, q.max].map((side) => (
              <div key={side} className={`hud-btn guess-btn ${value === side ? "is-focused" : ""}`} role="button">
                {impressionsValue(q, side)}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="impressions-value">
              <span className="scale-value">{impressionsValue(q, value)}</span>
              <span className="impressions-unit">{impressionsUnit(q)}</span>
            </div>
            <div className="scale-track">
              {Array.from({ length: ticks }, (_, n) => (
                <span key={n} className={`scale-tick ${n === at ? "is-focused" : n < at ? "is-under" : ""}`} />
              ))}
            </div>
            <div className="scale-ends">
              <span>{q.low}</span>
              <span>{q.high}</span>
            </div>
          </>
        )}
      </div>
      <div className="guess-hint impressions-hint">
        {view.youLocked ? "Locked in. Waiting for your partner" : view.theyLocked ? "Your partner is in. Tap to lock in" : "Scroll to choose, tap to lock in"}
      </div>
    </main>
  );
}

function Talk({ view, send, serverNow }: Props & { view: Of<"talk"> }) {
  const q = view.question;
  const ratings = impressionsRatings(q);
  const label = (rating: (typeof ratings)[number]) => (q.either ? (rating === "spot" ? "Yes" : "No") : IMPRESSIONS_RATING_LABEL[rating]);
  const [focus, setFocus] = useState(() => (view.yourRating ? Math.max(0, ratings.indexOf(view.yourRating)) : q.either ? 0 : 1));

  useInput(
    (action) => {
      if (action === "select") return send({ type: "rate", rating: ratings[focus] });
      const d = direction(action);
      if (d) setFocus((f) => Math.min(ratings.length - 1, Math.max(0, f + d)));
    },
    { pointer: true },
  );

  return (
    <main className="hud guess impressions">
      <Wobble />
      <Top round={view.round} rounds={view.rounds} deadline={view.deadline} serverNow={serverNow} />
      <div className="guess-eyebrow impressions-short">{q.short}</div>
      {/* Only the guess about you: it is the one you can judge. */}
      <div className="impressions-side is-them">
        <div className="impressions-who">Your partner guessed</div>
        <div className="impressions-num">{impressionsValue(q, view.theirGuess)}</div>
        <div className="impressions-said">{q.either ? "for you" : `${impressionsUnit(q)}, for you`}</div>
      </div>
      <div className={`guess-hint impressions-hint ${view.yourRating ? "is-set" : ""}`}>
        {view.yourRating ? `You said: ${label(view.yourRating).toLowerCase()}` : q.either ? "Did they get it right? Tell them." : "How close was that? Tell them."}
      </div>
      <div className="guess-row">
        {ratings.map((rating, i) => (
          <div
            key={rating}
            className={`hud-btn guess-btn impressions-rate ${focus === i ? "is-focused" : ""} ${view.yourRating === rating ? "is-picked" : ""}`}
            role="button"
            aria-pressed={view.yourRating === rating}
          >
            {label(rating)}
          </div>
        ))}
      </div>
    </main>
  );
}

function tallyText(t: ImpressionsTally): string {
  if (t.spot + t.close + t.off === 0) return "No word";
  return `${t.spot} spot on, ${t.close} close`;
}

function Done({ view, onNext, onAgain, last, votes }: Props & { view: Of<"done"> }) {
  return (
    <main className="hud guess impressions">
      <Wobble />
      <div className="guess-title guess-title-sm">First impressions</div>
      <div className="guess-list">
        <div className="guess-line">
          <span>Your guesses</span>
          <span className="guess-answer">{tallyText(view.yours)}</span>
        </div>
        <div className="guess-line">
          <span>Their guesses</span>
          <span className="guess-answer">{tallyText(view.theirs)}</span>
        </div>
      </div>
      <div className="guess-body impressions-verdict">{IMPRESSIONS_VERDICT_LABEL[view.verdict]}</div>
      <EndButtons onAgain={onAgain} onNext={onNext} last={last} votes={votes} />
    </main>
  );
}
