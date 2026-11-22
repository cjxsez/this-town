/**
 * TaleGame.tsx (glasses-web): "Tall tale" on the lens (protocol games/tale.ts).
 *
 *   intro    select: ready
 *   think    your secret card and a spark. select: ready
 *   tell     telling: your card as a reminder, select: done. listening: nothing to press
 *   verdict  left/up: "True", right/down: "Made up", select: lock it in
 *   reveal   both stories, the points, then the shared end buttons
 *
 * The lens is private, so the secret card is shown in the open here (the phone hides it
 * behind a hold-to-peek).
 */
import { useState } from "react";
import type { GameProps, TaleCard, TaleResult, TaleView } from "@questline/protocol/games";
import { Clock } from "../../components/Clock";
import { EndButtons } from "../../components/EndButtons";
import { Wobble } from "../../components/Wobble";
import { useInput } from "../../lib/input";
import { useOpensAt } from "../../lib/room";
import "./tale.css";

const CARD_TITLE: Record<TaleCard, string> = { truth: "Tell the truth", fake: "Make it up" };
const CARD_WORD: Record<TaleCard, string> = { truth: "True", fake: "Made up" };
const SPARK_LEAD: Record<TaleCard, string> = { truth: "Think of", fake: "Try" };
const CALLS: TaleCard[] = ["truth", "fake"];

export function TaleGame({ view, send, serverNow, onNext, onAgain, last, votes }: GameProps<TaleView>) {
  /** Focused verdict button: 0 "True", 1 "Made up". */
  const [focus, setFocus] = useState(0);
  // Done and the calls only count after the leftover-tap guard; until then they look held.
  const open = useOpensAt(view.phase === "tell" || view.phase === "verdict" ? view.opensAt : null, serverNow);

  useInput(
    (action) => {
      if (view.phase === "intro" || view.phase === "think") {
        if (action === "select" && !view.youReady) send({ type: "ready", phase: view.phase });
      } else if (view.phase === "tell") {
        if (action === "select" && view.telling && open) send({ type: "done", turn: view.turn });
      } else if (view.phase === "verdict" && view.yourCall === null) {
        if (action === "select") {
          if (open) send({ type: "call", call: CALLS[focus] });
        }
        else if (action === "left" || action === "up") setFocus(0);
        else if (action === "right" || action === "down") setFocus(1);
      }
    },
    { pointer: true },
  );

  if (view.phase === "intro") {
    return (
      <main className="hud hud-center guess guess-start">
        <Wobble />
        <div className="guess-title">Tall tale</div>
        <div className="guess-body">Tell your worst T story. It might be made up.</div>
        <div className="guess-hint">{view.youReady ? "Waiting for your partner" : "Then guess if theirs is true"}</div>
        <div className="guess-row">
          <div className={`hud-btn guess-btn ${view.youReady ? "" : "is-focused"}`} role="button">
            {view.youReady ? "Ready" : "Start"}
          </div>
        </div>
      </main>
    );
  }

  if (view.phase === "think") {
    return (
      <main className="hud guess">
        <Wobble />
        <div className="guess-top">
          <span className="guess-eyebrow">Your secret card</span>
          <Clock deadline={view.deadline} serverNow={serverNow} />
        </div>
        <div className={`guess-card tale-card is-${view.card}`}>
          <div className="tale-card-title">{CARD_TITLE[view.card]}</div>
          <div className="tale-spark">
            {SPARK_LEAD[view.card]}: {view.spark}
          </div>
        </div>
        <div className="guess-hint tale-center">
          {view.youReady ? "Waiting for your partner" : "Your worst ride on the T. Got one?"}
        </div>
        <div className="guess-row tale-row">
          <div className={`hud-btn guess-btn ${view.youReady ? "" : "is-focused"}`} role="button">
            Ready
          </div>
        </div>
      </main>
    );
  }

  if (view.phase === "tell") {
    if (!view.telling) {
      return (
        <main className="hud guess">
          <Wobble />
          <div className="guess-top">
            <span className="guess-eyebrow">Their story</span>
            <Clock deadline={view.deadline} serverNow={serverNow} />
          </div>
          <div className="guess-title tale-big">Listen</div>
          <div className="guess-body tale-center">Ask questions. Is it true, or made up?</div>
          <div className="guess-hint tale-center">{view.turn === 0 ? "You tell yours next" : "Then you both decide"}</div>
        </main>
      );
    }
    return (
      <main className="hud guess">
        <Wobble />
        <div className="guess-top">
          <span className="guess-eyebrow">Your turn</span>
          <Clock deadline={view.deadline} serverNow={serverNow} />
        </div>
        <div className="guess-title tale-big">Tell your story</div>
        {view.card && (
          <div className={`tale-reminder is-${view.card}`}>
            <span className="tale-reminder-card">{CARD_TITLE[view.card]}</span>
            <span className="tale-reminder-spark">{view.spark}</span>
          </div>
        )}
        <div className="guess-row tale-row">
          <div className="hud-btn guess-btn is-focused" role="button" aria-disabled={!open} style={open ? undefined : { opacity: 0.4 }}>
            Done
          </div>
        </div>
      </main>
    );
  }

  if (view.phase === "verdict") {
    return (
      <main className="hud guess">
        <Wobble />
        <div className="guess-top">
          <span className="guess-eyebrow">Your call</span>
          <Clock deadline={view.deadline} serverNow={serverNow} />
        </div>
        <div className="guess-card tale-center">Your partner's story was...</div>
        {view.yourCall === null ? (
          <>
            <div className="guess-row">
              {CALLS.map((call, i) => (
                <div
                  key={call}
                  className={`hud-btn guess-btn tale-call ${focus === i ? "is-focused" : ""}`}
                  role="button"
                  aria-pressed={focus === i}
                  aria-disabled={!open}
                  style={open ? undefined : { opacity: 0.4 }}
                >
                  {CARD_WORD[call]}
                </div>
              ))}
            </div>
            <div className="guess-hint tale-center">{view.theyCalled ? "Your partner has decided" : "No peeking at each other"}</div>
          </>
        ) : (
          <>
            <div className={`tale-word is-${view.yourCall}`}>{CARD_WORD[view.yourCall]}</div>
            <div className="guess-hint tale-center">Locked in. Waiting for your partner</div>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="hud guess tale-reveal">
      <Wobble />
      <div className="tale-stories">
        <Story label="Your story" result={view.yours} />
        <Story label="Their story" result={view.theirs} />
      </div>
      <div className="tale-summary">{view.summary}</div>
      <div className="tale-score">
        <span>
          You <b>{view.youPoints}</b>
        </span>
        <span>
          Partner <b>{view.theyPoints}</b>
        </span>
      </div>
      <EndButtons onAgain={onAgain} onNext={onNext} last={last} votes={votes} />
    </main>
  );
}

function Story({ label, result }: { label: string; result: TaleResult }) {
  return (
    <div className="tale-story">
      <div className="guess-eyebrow">{label}</div>
      <div className={`tale-story-word is-${result.card}`}>{CARD_WORD[result.card]}</div>
      <div className={`tale-story-note ${result.point ? "is-point" : ""}`}>
        {result.note}
        {result.point ? " +1" : ""}
      </div>
    </div>
  );
}
