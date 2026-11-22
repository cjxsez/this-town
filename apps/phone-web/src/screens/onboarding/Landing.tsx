import { useNavigate } from "react-router";
import { ArtSlot, Button, ButtonRow, Screen, TextLink } from "../../ui";
import { useApp } from "../../state/store";

/**
 * B1 Landing. Rendered at "/", and where a kiosk tag tap lands a rider with no profile
 * (the tap is replayed after onboarding). Every sign-in goes to B2.
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
            <Button variant="dark" tilt={-0.7} onClick={() => signIn("apple")}>
              Continue with Apple
            </Button>
          </ButtonRow>
          <ButtonRow>
            <Button variant="secondary" tilt={0.5} onClick={() => signIn("email")}>
              Email me a link
            </Button>
          </ButtonRow>
          <ButtonRow>
            <Button tilt={-0.4} onClick={() => signIn("guest")}>
              Just play today (first name only)
            </Button>
          </ButtonRow>
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
      <h1 style={{ font: "400 46px/1 var(--font-shade)", textAlign: "center" }}>QUESTLINE</h1>
      <p style={{ fontSize: 21, lineHeight: 1.2, textWrap: "pretty", textAlign: "center" }}>
        Tap the kiosk in your train car and meet one other rider who likes what you like. A short game, face to face, done before your stop.
      </p>
    </Screen>
  );
}
