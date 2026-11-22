import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button, Screen } from "../../ui";
import { useRide } from "../../state/store";
import { BumpQuestBar } from "./parts/BumpQuestBar";

const corner = (pos: CSSProperties): CSSProperties => ({
  position: "absolute",
  width: 26,
  height: 26,
  borderStyle: "solid",
  borderColor: "var(--mint)",
  borderWidth: 0,
  ...pos,
});

const yesPill: CSSProperties = { background: "var(--leaf)" };

export default function Photo() {
  const { ride, act, profile } = useRide();
  const m = ride.match;
  const name = m?.firstName ?? "Their";
  const whose = profile.hasGlasses ? "Your" : `${name}'s`;

  // null: not started; 3, 2, 1: counting down; 0: shutter.
  const [count, setCount] = useState<number | null>(null);
  const shot = useRef(false);

  useEffect(() => {
    if (count === null || count === 0) return;
    const t = setTimeout(() => {
      if (count > 1) setCount(count - 1);
      else {
        setCount(0);
        if (!shot.current) {
          shot.current = true;
          act.takePhoto();
        }
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [count, act]);

  const counting = count !== null;

  // Either person can cancel until the shutter.
  const cancel = () => {
    setCount(null);
    act.photoVote(false);
  };

  return (
    <Screen
      label="G3"
      blobs="b"
      footer={
        <ButtonStack>
          <Button onClick={() => setCount(3)} disabled={counting}>
            Take it
          </Button>
          <Button variant="secondary" onClick={cancel} disabled={count === 0}>
            Changed my mind
          </Button>
        </ButtonStack>
      }
    >
      <BumpQuestBar />
      <h1 style={{ font: "400 30px/1.02 var(--font-display)", textTransform: "uppercase" }}>Both said yes</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <span className="q-pill" style={yesPill}>
          You ✓
        </span>
        <span className="q-pill" style={{ ...yesPill, borderRadius: "var(--r2)" }}>
          {name} ✓
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 150,
          position: "relative",
          background: "var(--ink-deep)",
          color: "var(--mint)",
          border: "var(--ol) solid var(--ink)",
          borderRadius: "var(--r3)",
          boxShadow: "3px 5px 0 var(--shadow)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          overflow: "hidden",
          textAlign: "center",
        }}
      >
        <div aria-hidden style={corner({ left: 10, top: 10, borderTopWidth: 3, borderLeftWidth: 3 })} />
        <div aria-hidden style={corner({ right: 10, top: 10, borderTopWidth: 3, borderRightWidth: 3 })} />
        <div aria-hidden style={corner({ left: 10, bottom: 10, borderBottomWidth: 3, borderLeftWidth: 3 })} />
        <div aria-hidden style={corner({ right: 10, bottom: 10, borderBottomWidth: 3, borderRightWidth: 3 })} />
        <div style={{ font: "400 11px var(--font-display)", letterSpacing: ".06em", color: "#A9CDBF" }}>GLASSES WEARER'S VIEW</div>
        <div style={{ font: "700 32px/1.08 var(--font-hand)" }}>"Look this way"</div>
        {counting && count > 0 ? (
          <div
            key={count}
            className="anim-fadeIn"
            role="timer"
            aria-live="assertive"
            style={{ font: "400 88px/1 var(--font-display)" }}
          >
            {count}
          </div>
        ) : (
          <div style={{ font: "400 44px/1.02 var(--font-display)" }}>3 · 2 · 1</div>
        )}
        {count === 0 && (
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0, background: "var(--paper)", animation: "q-fadeIn .5s ease-out reverse both" }}
          />
        )}
      </div>

      <p style={{ fontSize: 20, lineHeight: 1.2, textWrap: "pretty", textAlign: "center" }}>
        {whose} glasses take one photo. No video.
      </p>
    </Screen>
  );
}

function ButtonStack({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>;
}
