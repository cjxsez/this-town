import { useNavigate } from "react-router";
import { Button, ButtonRow, Card, Eyebrow, Hint, Screen, TextField } from "../../ui";
import { useApp } from "../../state/store";
import { JoinSteps, JoinTitle } from "./parts";

/** B4 "Ask me about". Optional; Skip and Next are the same size. */
export default function AskMeAbout() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const d = state.draft;

  const next = () => {
    actions.updateDraft({ askMeAbout: d.askMeAbout?.trim() || undefined });
    navigate("/join/battery");
  };
  const skip = () => {
    actions.updateDraft({ askMeAbout: undefined });
    navigate("/join/battery");
  };

  return (
    <Screen
      label="B4"
      blobs="b"
      footer={
        <ButtonRow>
          <Button variant="secondary" onClick={skip}>
            Skip
          </Button>
          <Button onClick={next}>
            Next
          </Button>
        </ButtonRow>
      }
    >
      <JoinSteps step={3} />
      <JoinTitle>Give them an opener</JoinTitle>
      <Card style={{ borderRadius: "var(--r1)" }}>
        <Eyebrow>Ask me about (optional)</Eyebrow>
        <TextField
          label="Ask me about (optional)"
          value={d.askMeAbout ?? ""}
          onChange={(askMeAbout) => actions.updateDraft({ askMeAbout })}
          placeholder="e.g. the best bowl in Allston"
          maxLength={60}
        />
        <Hint style={{ fontSize: 18 }}>Helps us match you and write the "why you two" line your match sees. Never shown on the kiosk.</Hint>
      </Card>
    </Screen>
  );
}
