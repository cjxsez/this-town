import { useNavigate } from "react-router";
import { Button, ButtonRow, Card, Checkbox, Eyebrow, Hint, Screen, Segmented, TextField, Title } from "../../ui";
import { useApp } from "../../state/store";
import type { RiderKind } from "../../../shared/types";
import { JoinSteps } from "./parts";

const KINDS: { value: RiderKind; label: string }[] = [
  { value: "local", label: "a local" },
  { value: "student", label: "a student" },
  { value: "visiting", label: "visiting" },
];

/** B2 Name + 18+. Next is a hard gate: a first name AND the 18+ box. */
export default function Name() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const d = state.draft;
  const name = d.firstName ?? "";
  const ready = name.trim().length > 0 && d.is18 === true;

  return (
    <Screen
      label="B2"
      blobs="b"
      footer={
        <ButtonRow>
          <Button tilt={0.8} disabled={!ready} onClick={() => navigate("/join/interests")}>
            Next
          </Button>
        </ButtonRow>
      }
    >
      <JoinSteps step={1} />
      <Title>What should people call you?</Title>
      <Card>
        <Eyebrow>First name</Eyebrow>
        <TextField
          label="First name"
          value={name}
          onChange={(v) => actions.updateDraft({ firstName: v.replace(/\s+/g, " ").trimStart() })}
          maxLength={24}
          autoComplete="given-name"
        />
        <Hint>First name only. We never ask for a last name.</Hint>
        <Eyebrow style={{ marginTop: 8 }}>I am</Eyebrow>
        <Segmented
          label="I am"
          options={KINDS}
          value={d.kind ?? "local"}
          onChange={(kind) => actions.updateDraft({ kind })}
        />
        <Checkbox checked={d.is18 === true} onChange={(is18) => actions.updateDraft({ is18 })}>
          I'm 18 or older
        </Checkbox>
      </Card>
    </Screen>
  );
}
