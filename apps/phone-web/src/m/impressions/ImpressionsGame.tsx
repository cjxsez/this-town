import { useState } from "react";
import {
  IMPRESSIONS_RATING_LABEL,
  IMPRESSIONS_VERDICT_LABEL,
  impressionsUnit,
  impressionsValue,
  type GameProps,
  type ImpressionsRating,
  type ImpressionsTally,
  type ImpressionsView,
} from "@questline/protocol/games";
import { Body, Button, ButtonRow, Card, Eyebrow, Hint, Screen, Steps, Title } from "../../ui";
import { Clock } from "../Clock";
import { EndButtons } from "../EndButtons";
import "./impressions.css";

/**
 * "First impressions" on the phone (protocol games/impressions.ts): guess your partner on
 * a slider, lock it in, then compare and say how close they were.
 */

type Props = GameProps<ImpressionsView>;
type Of<P extends ImpressionsView["phase"]> = Extract<ImpressionsView, { phase: P }>;

const RATINGS: ImpressionsRating[] = ["spot", "close", "off"];

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
      </Card>
      <Hint>{view.youLocked ? "Locked in. No peeking." : view.theyLocked ? "Your partner has locked in." : "Guess quietly. You'll compare in a moment."}</Hint>
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
          <div className="impressions-ask">How close was their guess about you?</div>
          <ButtonRow>
            {RATINGS.map((rating, i) => (
              <Button
                key={rating}
                variant={view.yourRating === rating ? "primary" : "secondary"}
                tilt={i === 1 ? 0.5 : -0.5}
                aria-pressed={view.yourRating === rating}
                className="impressions-rate"
                onClick={() => send({ type: "rate", rating })}
              >
                {IMPRESSIONS_RATING_LABEL[rating]}
              </Button>
            ))}
          </ButtonRow>
        </>
      }
    >
      <Top round={view.round} rounds={view.rounds} deadline={view.deadline} serverNow={serverNow} />
      <Title size="md">{q.short}</Title>
      <div className="impressions-pair">
        <Card tight className="impressions-side">
          <div className="impressions-who">You guessed</div>
          <div className="impressions-num">{impressionsValue(q, view.yourGuess)}</div>
          <div className="impressions-for">for your partner</div>
        </Card>
        <Card tight className="impressions-side is-them">
          <div className="impressions-who">They guessed</div>
          <div className="impressions-num">{impressionsValue(q, view.theirGuess)}</div>
          <div className="impressions-for">for you</div>
        </Card>
      </div>
      {!q.unit && (
        <Hint>
          {q.min} is {q.low.toLowerCase()}, {q.max} is {q.high.toLowerCase()}.
        </Hint>
      )}
      <Body>How close were they? Tell them.</Body>
      {view.theirRating && (
        <Card ink tight style={{ rotate: "-0.5deg" }}>
          <div className="impressions-heard">Your partner says your guess was {IMPRESSIONS_RATING_LABEL[view.theirRating].toLowerCase()}.</div>
        </Card>
      )}
    </Screen>
  );
}

function tallyText(t: ImpressionsTally): string {
  if (t.spot + t.close + t.off === 0) return "No word";
  return `${t.spot} spot on, ${t.close} close`;
}

function Done({ view, onNext, onAgain }: Props & { view: Of<"done"> }) {
  return (
    <Screen label="M-impressions-done" footer={<EndButtons onNext={onNext} onAgain={onAgain} />}>
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
