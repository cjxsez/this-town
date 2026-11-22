import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { api } from "../../api";
import { ApiError, errorMessage } from "../../lib/api";
import { useApp } from "../../state/store";
import { BackLink, Body, Button, ButtonRow, Card, Eyebrow, Hint, Screen, TextField, TextLink, Title } from "../../ui";
import { peekPendingCar } from "../ride/Tap";

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/**
 * S1 Sign in with email. Sends a 6-digit code (POST /api/auth/email/start) and moves on to
 * S2. Reached from the landing page, and from a kiosk tag tapped while signed out.
 */
export default function SignInEmail() {
  const navigate = useNavigate();
  const { state } = useApp();
  const [email, setEmail] = useState(state.draft.email ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const car = peekPendingCar();
  const ready = looksLikeEmail(email) && !sending;

  const send = async () => {
    if (!ready) return;
    const addr = email.trim().toLowerCase();
    setSending(true);
    setError(null);
    try {
      await api.auth.sendCode(addr);
    } catch (e) {
      // "too-soon" means a code is already on its way, so carry on to the code screen.
      const tooSoon = e instanceof ApiError && (e.body as { code?: string } | undefined)?.code === "too-soon";
      if (!tooSoon) {
        setError(errorMessage(e));
        setSending(false);
        return;
      }
    }
    navigate(`/signin/code?email=${encodeURIComponent(addr)}`);
  };

  if (state.profile) return <Navigate to="/ride" replace />;

  return (
    <Screen
      label="S1"
      blobs="b"
      footer={
        <>
          <ButtonRow>
            <Button disabled={!ready} onClick={() => void send()}>
              {sending ? "Sending…" : "Email me a code"}
            </Button>
          </ButtonRow>
          <TextLink to="/join/name">No email? Just play today</TextLink>
        </>
      }
    >
      <BackLink to="/">Back</BackLink>
      <Title>Sign in with your email</Title>
      {car && <Body>Then we'll check you in to car {car}.</Body>}
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          style={{ display: "contents" }}
        >
          <Eyebrow>Email</Eyebrow>
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(v) => {
              setEmail(v);
              setError(null);
            }}
            placeholder="you@example.com"
            maxLength={254}
          />
        </form>
        {error ? (
          <Hint style={{ color: "var(--brick)" }}>
            <span role="alert">{error}</span>
          </Hint>
        ) : (
          <Hint>We'll email you a 6-digit code. No password. New here? The same code sets up your account.</Hint>
        )}
      </Card>
    </Screen>
  );
}
