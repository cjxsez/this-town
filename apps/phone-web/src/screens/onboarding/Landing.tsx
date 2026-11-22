import { useNavigate } from "react-router";
import { ArtSlot, Button, ButtonRow, Screen, TextLink } from "../../ui";
import { useApp } from "../../state/store";

/**
 * B1 Landing. Rendered at "/", and where a kiosk tag tap lands a rider with no profile in
 * simulator mode (against the worker a signed-out tap goes to S1 /signin instead; the tap is
 * replayed after sign-in or onboarding). Email goes to S1 (6-digit code: returning riders
 * sign straight back in, new ones carry on to B2 as an account). "Just play today" goes to B2
 * as a guest.
 */
export default function Landing() {
  const navigate = useNavigate();
  const { actions } = useApp();

  const signIn = (method: "email" | "guest") => navigate(method === "email" ? "/signin" : "/join/name");

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
            <Button variant="dark" tilt={-0.7} onClick={() => signIn("email")}>
              Sign in with email
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
