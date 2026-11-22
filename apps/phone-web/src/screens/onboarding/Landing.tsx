import { useNavigate } from "react-router";
import { ArtSlot, Button, ButtonRow, Screen, TextLink, Wordmark } from "../../ui";
import { useApp } from "../../state/store";

/**
 * B1 Landing from QR. Rendered at "/" and at "/:stationId" (the poster's
 * deep link; App has already put the station into draft.homeStation).
 * Every sign-in goes to B2; a badge already in hand goes to B7.
 */
export default function Landing() {
  const navigate = useNavigate();
  const { actions } = useApp();

  // TODO(backend): Sign in with Apple and the email magic link are stubs.
  // Both should authenticate first and then continue to B2 like "Just play today".
  const signIn = (_method: "apple" | "email" | "guest") => navigate("/join/name");

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
            <Button variant="dark" onClick={() => signIn("apple")}>
              Continue with Apple
            </Button>
          </ButtonRow>
          <ButtonRow>
            <Button variant="secondary" onClick={() => signIn("email")}>
              Email me a link
            </Button>
          </ButtonRow>
          <ButtonRow>
            <Button onClick={() => signIn("guest")}>
              Just play today (first name only)
            </Button>
          </ButtonRow>
          <TextLink to="/join/badge">Already have a badge? Scan it</TextLink>
        </>
      }
    >
      <div style={{ flex: 1, minHeight: 200, position: "relative", margin: "0 calc(-1 * var(--gutter))" }}>
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
        <Wordmark />
      </h1>
      <p style={{ fontSize: 21, lineHeight: 1.2, textWrap: "pretty", textAlign: "center" }}>
        Short games with one other rider while you wait. Spoken, face to face, done before the train.
      </p>
    </Screen>
  );
}
