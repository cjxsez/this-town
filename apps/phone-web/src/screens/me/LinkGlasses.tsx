import { useState } from "react";
import { Body, Button, ButtonRow, Card, Hint, Screen, TextField } from "../../ui";
import { linkGlassesErrorMessage } from "../../lib/linkGlassesError";
import { useApp } from "../../state/store";
import { JoinTitle } from "../onboarding/parts";

/**
 * Link your glasses, from Me > Glasses (it is not a sign-up step). Open In This Town on the
 * Meta Ray-Ban Display, read the 4-digit code on the lens, type it here. Glasses are
 * optional: without them, the phone shows everything.
 */
export default function LinkGlasses({ onBack, onLinked }: { onBack: () => void; onLinked: () => void }) {
  const { actions } = useApp();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      await actions.linkGlasses(code);
      onLinked();
    } catch (e) {
      setError(linkGlassesErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      label="J2"
      blobs="b"
      footer={
        <ButtonRow>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button disabled={busy || !/^\d{4}$/.test(code)} onClick={() => void link()}>
            {busy ? "Linking…" : "Link"}
          </Button>
        </ButtonRow>
      }
    >
      <JoinTitle>Link your glasses</JoinTitle>
      <Card style={{ gap: 8 }}>
        <Body style={{ margin: 0 }}>Open In This Town on your Meta Ray-Ban Display. It shows a 4-digit code. Type it here.</Body>
        <TextField
          label="Code on your glasses"
          value={code}
          onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 4))}
          placeholder="0000"
          maxLength={4}
          inputMode="numeric"
        />
        {error && (
          <Hint style={{ color: "var(--brick)" }}>{error}</Hint>
        )}
        <Hint>No glasses? You don't need them: your phone shows everything the glasses would.</Hint>
      </Card>
    </Screen>
  );
}
