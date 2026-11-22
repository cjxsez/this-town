import { useNavigate } from "react-router";
import { Body, Button, ButtonRow, Card, Checkbox, Eyebrow, Hint, Screen } from "../../ui";
import { useApp } from "../../state/store";
import { JoinSteps, JoinTitle } from "./parts";

/**
 * B6 How Ride Mode works. There's no accept step on a match, so riders learn here, once,
 * that turning on Ride Mode is the yes. Every ride confirms it again on the kiosk tap.
 */
export default function RideModeRules() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const agreed = state.draft.rulesAccepted === true;

  return (
    <Screen
      label="B6"
      blobs="a"
      footer={
        <ButtonRow>
          <Button disabled={!agreed} onClick={() => navigate("/join/glasses")}>
            Next
          </Button>
        </ButtonRow>
      }
    >
      <JoinSteps step={5} />
      <JoinTitle>How Ride Mode works</JoinTitle>
      <Card style={{ gap: 10, borderRadius: "var(--r2)" }}>
        <Eyebrow>Turning it on is your yes</Eyebrow>
        <Body style={{ margin: 0 }}>Tap the kiosk in your train car and turn on Ride Mode. While it's on, we match you with the closest rider on that train who shares your interests. Nobody asks you again.</Body>
        <Eyebrow>What people see</Eyebrow>
        <Body style={{ margin: 0 }}>Your match sees your first name, your pair color and why you were matched. The kiosk screen is public, so it only shows first names. No photos, no last names, no location.</Body>
        <Eyebrow>Always one tap away</Eyebrow>
        <Body style={{ margin: 0 }}>"Not now" skips a match. Ghost mode hides you for the ride. You can report or block anyone. Ride Mode turns off at your stop.</Body>
      </Card>
      <Checkbox checked={agreed} onChange={(v) => actions.updateDraft({ rulesAccepted: v })}>
        I'm 18+ and I get it: Ride Mode on means I can be matched.
      </Checkbox>
      <Hint>You'll confirm again each time you turn it on.</Hint>
    </Screen>
  );
}
