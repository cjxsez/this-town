import { useState } from "react";
import { useNavigate } from "react-router";
import { Body, Button, ButtonRow, Card, Eyebrow, Hint, Screen, TextField, TextLink } from "../../ui";
import { errorMessage } from "../../lib/api";
import { useApp } from "../../state/store";
import { takePendingTap } from "../ride/Tap";
import { JoinSteps, JoinTitle } from "./parts";

/**
 * B7 Link your glasses. Open Questline on the Meta Ray-Ban Display, read the 4-digit code
 * on the lens, type it here. Optional: without glasses, this phone shows everything.
 * Linking needs the rider to exist, so this step creates them first.
 */
export default function LinkGlasses() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const onboarding = !state.profile;

  // A kiosk tap made before joining picks up where it left off (pick your stop, Ride Mode).
  const done = () => navigate(takePendingTap() ?? "/ride", { replace: true });

  const ensureProfile = async () => {
    if (!state.profile) await actions.finishOnboarding();
  };

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      await ensureProfile();
      await actions.linkGlasses(code);
      setLinked(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    await ensureProfile();
    done();
  };

  return (
    <Screen
      label="B7"
      blobs="b"
      footer={
        linked ? (
          <Button tilt={0.6} onClick={done}>
            Start riding
          </Button>
        ) : (
          <ButtonRow>
            <Button variant="secondary" tilt={-0.5} onClick={() => void skip()}>
              No glasses
            </Button>
            <Button tilt={0.6} disabled={busy || !/^\d{4}$/.test(code)} onClick={() => void link()}>
              {busy ? "Linking…" : "Link"}
            </Button>
          </ButtonRow>
        )
      }
    >
      {onboarding && <JoinSteps step={6} />}
      <JoinTitle>Link your glasses</JoinTitle>
      {linked ? (
        <Card style={{ gap: 6, background: "var(--leaf)" }}>
          <Eyebrow>Linked</Eyebrow>
          <Body style={{ margin: 0 }}>Your glasses will show your match and where to meet. Keep Questline open on them while you ride.</Body>
        </Card>
      ) : (
        <Card style={{ gap: 8 }}>
          <Body style={{ margin: 0 }}>Open Questline on your Meta Ray-Ban Display. It shows a 4-digit code. Type it here.</Body>
          <TextField
            label="Code on your glasses"
            value={code}
            onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 4))}
            placeholder="0000"
            maxLength={4}
            inputMode="numeric"
          />
          {error && (
            <Hint style={{ color: "var(--brick)" }}>
              {error.includes("expired") || error.includes("404") ? "That code didn't work. Codes last 5 minutes; check the lens for a fresh one." : error}
            </Hint>
          )}
          <Hint>No glasses? Skip this. Your phone shows everything the glasses would.</Hint>
        </Card>
      )}
      {!onboarding && !linked && <TextLink to="/me">Back</TextLink>}
    </Screen>
  );
}
