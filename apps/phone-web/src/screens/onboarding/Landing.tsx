import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { ArtSlot, Button, ButtonRow, Screen, TextLink, Wordmark } from "../../ui";
import { useApp } from "../../state/store";
import { DOORS_ENTER_DELAY_MS, doorsOpening } from "../../state/doors";

/**
 * B1 Landing. Rendered at "/", and where a kiosk tag tap lands a rider with no profile
 * (the tap is replayed after onboarding). Two ways in: a one-time code by email, or
 * "Just play today" with a first name only. Every sign-in goes to B2.
 *
 * Everything enters in order: the island, the name tile by tile, the line, then the
 * buttons. When the start screen's doors are opening onto this page, it all waits
 * until they have parted.
 */
export default function Landing() {
  const navigate = useNavigate();
  const { actions } = useApp();
  // Read once: whether the train doors are opening onto this page right now.
  const [offset] = useState(() => (doorsOpening() ? DOORS_ENTER_DELAY_MS : 0));
  /** Entrance `ms` after the page appears (plus the doors' delay), merged with any style of its own. */
  const at = (ms: number, style?: CSSProperties) => ({ className: "q-enter", style: { ...style, "--d": offset + ms } as CSSProperties });

  // TODO(backend): the one-time email code is PR #4 (feat/email-signin). Until it lands,
  // email continues like "Just play today"; with it, email goes to its /signin code screen.
  const signIn = (_method: "email" | "guest") => navigate("/join/name");

  const skipSetup = () => {
    actions.useDemoProfile();
    navigate("/ride");
  };

  return (
    <Screen
      label="B1"
      blobs="a"
      footer={
        <>
          <ButtonRow>
            <Button variant="secondary" onClick={() => signIn("email")} {...at(520)}>
              Sign in with email
            </Button>
          </ButtonRow>
          <ButtonRow>
            <Button onClick={() => signIn("guest")} {...at(600)}>
              Just play today (first name only)
            </Button>
          </ButtonRow>
        </>
      }
    >
      <div {...at(0, { flex: 1, minHeight: 200, position: "relative", margin: "0 calc(-1 * var(--gutter))" })}>
        <div
          className="anim-drift"
          style={{
            position: "absolute",
            zIndex: -1,
            right: 32,
            top: 14,
            width: 120,
            height: 58,
            borderRadius: "58% 42% 55% 45%/48% 60% 40% 52%",
            background: "var(--foam)",
            filter: "var(--rag)",
          }}
        />
        <ArtSlot
          id="hero-art"
          fit="contain"
          placeholder="hero art (UI team)"
          style={{ position: "absolute", left: 24, right: 24, top: 4, bottom: 6 }}
        />
        {/* For hackathon judges: jump straight into Ride Mode with a demo rider. */}
        <TextLink
          small
          onClick={skipSetup}
          style={{ position: "absolute", right: 30, top: 6, fontSize: 15, opacity: 0.7, minHeight: 44, padding: "0 6px" }}
        >
          demo: skip setup
        </TextLink>
      </div>
      <h1>
        <Wordmark enterAt={offset + 120} />
      </h1>
      <p {...at(440, { fontSize: 21, lineHeight: 1.2, textWrap: "pretty", textAlign: "center" })}>
        Tap the kiosk in your train car and meet one other rider who likes what you like. A short game, face to face, done before your stop.
      </p>
    </Screen>
  );
}
