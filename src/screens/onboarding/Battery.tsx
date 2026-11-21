import { useNavigate } from "react-router";
import { Button, ButtonRow, Card, Hint, Radio, Screen, Toggle } from "../../ui";
import { useApp } from "../../state/store";
import type { SocialBattery } from "../../../shared/types";
import { JoinSteps, JoinTitle } from "./parts";

const LEVELS: { value: SocialBattery; label: string; detail: string }[] = [
  { value: "nod", label: "Nod", detail: "quick, low-key" },
  { value: "chat", label: "Chat", detail: "a couple of minutes" },
  { value: "talk", label: "Talk", detail: "happy to go deep" },
];

/** B5 Social battery + AI. AI matching is off by default. */
export default function Battery() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const battery = state.draft.battery ?? "chat";
  const useAi = state.draft.useAi === true;

  return (
    <Screen
      label="B5"
      blobs="a"
      footer={
        <ButtonRow>
          <Button
            tilt={0.5}
            onClick={() => {
              actions.updateDraft({ battery, useAi });
              navigate("/join/handles");
            }}
          >
            Next
          </Button>
        </ButtonRow>
      }
    >
      <JoinSteps step={4} />
      <JoinTitle>How social are you feeling, usually?</JoinTitle>
      <Card style={{ gap: 2, borderRadius: "var(--r4)" }}>
        <div role="radiogroup" aria-label="Social battery">
          {LEVELS.map((l) => (
            <Radio key={l.value} checked={battery === l.value} onSelect={() => actions.updateDraft({ battery: l.value })}>
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ font: "700 22px/1.05 var(--font-hand)" }}>{l.label}</span>
                <span style={{ color: "var(--ink-soft)", fontSize: 18 }}>{l.detail}</span>
              </span>
            </Radio>
          ))}
        </div>
        <Hint>You can change this every ride.</Hint>
      </Card>
      <Card style={{ rotate: "-0.7deg", borderRadius: "var(--r1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ font: "700 24px/1.08 var(--font-hand)" }}>
            Use AI to match me
          </div>
          <Toggle label="Use AI to match me" checked={useAi} onChange={(v) => actions.updateDraft({ useAi: v })} />
        </div>
        <Hint>
          Sends your interests, spots and "ask me about" to Gemini once, now. Never your handles, badge or location.
        </Hint>
      </Card>
    </Screen>
  );
}
