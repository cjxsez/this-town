import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { api } from "../../api";
import { ApiError, errorMessage } from "../../lib/api";
import { useApp } from "../../state/store";
import { BackLink, Body, Button, ButtonRow, Card, Eyebrow, Hint, Screen, TextField, TextLink, Title } from "../../ui";
import { takePendingTap } from "../ride/Tap";

const RESEND_AFTER_S = 30;

/**
 * S2 Enter the code. POST /api/auth/email/verify:
 * - existing account: its profile lands on this phone, then back to the parked kiosk tap
 *   (or Ride Mode);
 * - new email: onboarding (B2…B7), and the rider is created as an account with this email.
 * Submits by itself once six digits are in (iOS offers the code from Mail as a suggestion).
 */
export default function SignInCode() {
  const navigate = useNavigate();
  const { actions } = useApp();
  const [query] = useSearchParams();
  const email = query.get("email") ?? "";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = async (value: string) => {
    if (value.length !== 6 || submitted.current === value) return;
    submitted.current = value;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.auth.verifyCode(email, value);
      if (res.status === "signed-in") {
        actions.signedIn(res.profile);
        navigate(takePendingTap() ?? "/ride", { replace: true });
      } else {
        actions.updateDraft({ email: res.email });
        navigate("/join/name", { replace: true });
      }
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
      // An expired or burnt code needs a new one, so let them resend right away.
      const reason = e instanceof ApiError ? e.code : undefined;
      if (reason === "expired" || reason === "too-many-attempts") setWait(0);
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    setCode("");
    submitted.current = null;
    try {
      await api.auth.sendCode(email);
      setNotice("New code sent. The old one no longer works.");
      setWait(RESEND_AFTER_S);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!email) return <Navigate to="/signin" replace />;

  return (
    <Screen
      label="S2"
      blobs="a"
      footer={
        <ButtonRow>
          <Button disabled={code.length !== 6 || busy} onClick={() => void verify(code)}>
            {busy ? "Checking…" : "Continue"}
          </Button>
        </ButtonRow>
      }
    >
      <BackLink to="/signin">Use a different email</BackLink>
      <Title>Check your email</Title>
      <Body>
        We sent a 6-digit code to <strong style={{ overflowWrap: "anywhere" }}>{email}</strong>.
      </Body>
      <Card>
        <Eyebrow>Code</Eyebrow>
        <TextField
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            setError(null);
            if (digits.length === 6) void verify(digits);
          }}
        />
        {error ? (
          <Hint style={{ color: "var(--brick)" }}>
            <span role="alert">{error}</span>
          </Hint>
        ) : (
          <Hint>{notice ?? "It works for 10 minutes. Check spam if it's not there."}</Hint>
        )}
      </Card>
      {wait > 0 ? (
        <Hint style={{ textAlign: "center" }}>Send a new code in {wait} s</Hint>
      ) : (
        <TextLink onClick={() => void resend()}>Send a new code</TextLink>
      )}
    </Screen>
  );
}
