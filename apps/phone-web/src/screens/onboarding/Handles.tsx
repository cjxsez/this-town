import { useNavigate } from "react-router";
import { Body, Button, ButtonRow, Card, Eyebrow, Hint, Screen, TextField } from "../../ui";
import { useApp } from "../../state/store";
import type { Handles as HandleSet } from "../../../shared/types";
import { JoinSteps, JoinTitle } from "./parts";

/** People paste "@name" or "name "; store the bare handle. */
const clean = (v: string) => v.replace(/^\s*@+/, "").replace(/\s+/g, "");

/** B6 Handles (optional). Skip is the same size as Save. */
export default function Handles() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const h = state.draft.handles ?? {};

  const set = (key: keyof HandleSet, v: string) => actions.updateDraft({ handles: { ...h, [key]: clean(v) } });

  const save = () => {
    actions.updateDraft({ handles: { instagram: h.instagram || undefined, snapchat: h.snapchat || undefined } });
    navigate("/join/badge");
  };
  // Skip leaves no handles behind, even half-typed ones.
  const skip = () => {
    actions.updateDraft({ handles: {} });
    navigate("/join/badge");
  };

  return (
    <Screen
      label="B6"
      blobs="b"
      footer={
        <ButtonRow>
          <Button variant="secondary" onClick={skip}>
            Skip
          </Button>
          <Button onClick={save}>
            Save
          </Button>
        </ButtonRow>
      }
    >
      <JoinSteps step={5} />
      <JoinTitle>Want to stay in touch after a quest?</JoinTitle>
      <Body style={{ fontSize: 21 }}>Add a handle. Nobody sees it unless you both say yes after meeting.</Body>
      <Card style={{ borderRadius: "var(--r1)" }}>
        <Eyebrow>Instagram</Eyebrow>
        <TextField label="Instagram handle" prefix="@" value={h.instagram ?? ""} onChange={(v) => set("instagram", v)} maxLength={31} />
        <Eyebrow style={{ marginTop: 6 }}>Snapchat</Eyebrow>
        <TextField label="Snapchat handle" prefix="@" value={h.snapchat ?? ""} onChange={(v) => set("snapchat", v)} maxLength={31} />
        <Hint>Hidden by default. Shared per person, only when both of you switch on "Stay in touch".</Hint>
      </Card>
    </Screen>
  );
}
