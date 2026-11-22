import { useState } from "react";
import {
  IMPRESSIONS_RATING_LABEL,
  IMPRESSIONS_VERDICT_LABEL,
  impressionsRatings,
  impressionsUnit,
  impressionsValue,
  type GameProps,
  type ImpressionsTally,
  type ImpressionsView,
} from "@questline/protocol/games";
import { Body, Button, ButtonRow, Card, Eyebrow, Hint, Screen, Steps, Title } from "../../ui";
import { Clock } from "../Clock";
import { EndButtons } from "../EndButtons";
import "./impressions.css";

/**
 * "First impressions" on the phone (protocol games/impressions.ts): guess your partner on
 * a slider, lock it in, then see what they guessed about you and say how close it was.
 */

type Props = GameProps<ImpressionsView>;
type Of<P extends ImpressionsView["phase"]> = Extract<ImpressionsView, { phase: P }>;

export function ImpressionsGame(props: Props) {
  const { view } = props;
  if (view.phase === "intro") return <Intro {...props} view={view} />;
  if (view.phase === "guess") return <Guess key={view.round} {...props} view={view} />;
  if (view.phase === "talk") return <Talk {...props} view={view} />;
  return <Done {...props} view={view} />;
}

function Intro({ view, send }: Props & { view: Of<"intro"> }) {
  return (
    <Screen
      label="M-impressions-intro"
      footer={
        <Button disabled={view.youReady} onClick={() => send({ type: "ready" })}>
          {view.youReady ? "Waiting for your partner" : "Start"}
        </Button>
      }
    >
      <Eyebrow>{view.rounds} quick rounds</Eyebrow>
      <Title>First impressions</Title>
      <Body>Guess your partner from first impressions. No asking yet.</Body>
      <Hint>Slide to your guess and lock it in. Then you both see what the other one thought.</Hint>
      {view.theyReady && !view.youReady && <Hint>Your partner is ready.</Hint>}
    </Screen>
  );
}

function Top({ round, rounds, deadline, serverNow }: { round: number; rounds: number; deadline: number; serverNow: () => number }) {
  return (
    <div className="impressions-top">
      <div className="impressions-progress">
        <Eyebrow>
          {round + 1} of {rounds}
        </Eyebrow>
        <Steps total={rounds} current={round + 1} />
      </div>
      <Clock deadline={deadline} serverNow={serverNow} />
    </div>
  );
}

function Guess({ view, send, serverNow }: Props & { view: Of<"guess"> }) {
  const q = view.question;
  const [pick, setPick] = useState(view.yourValue);
  const value = view.youLocked ? view.yourValue : pick;
  const fill = ((value - q.min) / (q.max - q.min)) * 100;

  return (
    <Screen
      label="M-impressions-guess"
      blobs="b"
      footer={
        <Button disabled={view.youLocked} onClick={() => send({ type: "lock", value: pick })}>
          {view.youLocked ? "Waiting for your partner" : "Lock in"}
        </Button>
      }
    >
      <Top round={view.round} rounds={view.rounds} deadline={view.deadline} serverNow={serverNow} />
      <Card>
        <Title size="md">{q.prompt}</Title>
      </Card>
      <Card className={`impressions-slider ${view.youLocked ? "is-locked" : ""}`} style={{ rotate: "0.4deg" }}>
        {q.either ? (
          <ButtonRow>
            {[q.min, q.max].map((side) => (
              <Button
                key={side}
                variant={value === side ? "primary" : "secondary"}
                aria-pressed={value === side}
                disabled={view.youLocked}
                onClick={() => {
                  if (side === pick) return;
                  setPick(side);
                  send({ type: "slide", value: side });
                }}
              >
                {impressionsValue(q, side)}
              </Button>
            ))}
          </ButtonRow>
        ) : (
          <>
            <div className="impressions-value">
              <span className="impressions-num">{impressionsValue(q, value)}</span>
              <span className="impressions-unit">{impressionsUnit(q)}</span>
            </div>
            <input
              className="impressions-range"
              type="range"
              aria-label="Your guess"
              min={q.min}
              max={q.max}
              step={q.step}
              value={value}
              disabled={view.youLocked}
              style={{ "--fill": `${fill}%` } as React.CSSProperties}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (next === pick) return;
                setPick(next);
                send({ type: "slide", value: next });
              }}
            />
            <div className="impressions-ends">
              <span>{q.low}</span>
              <span>{q.high}</span>
            </div>
          </>
        )}
      </Card>
      <Hint>
        {view.youLocked
          ? "Locked in. No peeking."
          : view.theyLocked
            ? "Your partner has locked in."
            : q.either
              ? "Pick one quietly. You'll compare in a moment."
              : "Guess quietly. You'll compare in a moment."}
      </Hint>
    </Screen>
  );
}

function Talk({ view, send, serverNow }: Props & { view: Of<"talk"> }) {
  const q = view.question;
  return (
    <Screen
      label="M-impressions-talk"
      blobs="c"
      footer={
        <>
          <div className="impressions-ask">{q.either ? "Did they get it right?" : "How close was their guess?"}</div>
          <ButtonRow>
            {impressionsRatings(q).map((rating) => (
              <Button
                key={rating}
                variant={view.yourRating === rating ? "primary" : "secondary"}
                aria-pressed={view.yourRating === rating}
                className="impressions-rate"
                onClick={() => send({ type: "rate", rating })}
              >
                {q.either ? (rating === "spot" ? "Yes" : "No") : IMPRESSIONS_RATING_LABEL[rating]}
              </Button>
            ))}
          </ButtonRow>
        </>
      }
    >
      <Top round={view.round} rounds={view.rounds} deadline={view.deadline} serverNow={serverNow} />
      <Title size="md">{q.short}</Title>
      {/* Only the guess about you: it is the one you can judge. Your own guess is on the end screen. */}
      <Card tight className="impressions-side is-them">
        <div className="impressions-who">Your partner guessed</div>
        <div className="impressions-num">{impressionsValue(q, view.theirGuess)}</div>
        <div className="impressions-for">{q.either ? "for you" : `${impressionsUnit(q)}, for you`}</div>
      </Card>
      {!q.unit && !q.either && (
        <Hint>
          {q.min} is {q.low.toLowerCase()}, {q.max} is {q.high.toLowerCase()}.
        </Hint>
      )}
      <Body>Tell them the real answer.</Body>
    </Screen>
  );
}

function tallyText(t: ImpressionsTally): string {
  if (t.spot + t.close + t.off === 0) return "No word";
  return `${t.spot} spot on, ${t.close} close`;
}

function Done({ view, onNext, onAgain, last }: Props & { view: Of<"done"> }) {
  return (
    <Screen label="M-impressions-done" footer={<EndButtons onNext={onNext} onAgain={onAgain} last={last} />}>
      <Eyebrow>First impressions</Eyebrow>
      <Title>{IMPRESSIONS_VERDICT_LABEL[view.verdict]}</Title>
      <Card tight>
        <div className="impressions-line">
          <span>Your guesses</span>
          <b>{tallyText(view.yours)}</b>
        </div>
        <div className="impressions-line">
          <span>Their guesses</span>
          <b>{tallyText(view.theirs)}</b>
        </div>
      </Card>
      <Card tight style={{ rotate: "0.4deg" }}>
        {view.rows.map((row) => (
          <div className="impressions-line" key={row.question.id}>
            <span>
              {row.question.short}: {impressionsValue(row.question, row.yourGuess)}
            </span>
            <b className={row.rating ? `is-${row.rating}` : "is-none"}>{row.rating ? IMPRESSIONS_RATING_LABEL[row.rating] : "No word"}</b>
          </div>
        ))}
      </Card>
      <Hint>Your guesses, and what your partner said about each.</Hint>
    </Screen>
  );
}
