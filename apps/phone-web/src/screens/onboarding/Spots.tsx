import { useNavigate } from "react-router";
import { Button, ButtonRow, Card, Chip, Eyebrow, Hint, Screen, TextField } from "../../ui";
import { useApp } from "../../state/store";
import { spotsFor } from "../../../shared/catalog";
import { JoinSteps, JoinTitle, joinStation } from "./parts";

/** B4 Spots + "ask me about". Both optional; Skip and Next are the same size. */
export default function Spots() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const d = state.draft;
  const station = joinStation(d.homeStation);
  const picked = d.spots ?? [];

  const toggle = (id: string) =>
    actions.updateDraft({ spots: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });

  const next = () => {
    actions.updateDraft({ askMeAbout: d.askMeAbout?.trim() || undefined });
    navigate("/join/battery");
  };
  // Skip means "none of this": leave the step empty rather than half-filled.
  const skip = () => {
    actions.updateDraft({ spots: [], askMeAbout: undefined });
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
      <JoinTitle>Favorite spots near {station.name}</JoinTitle>
      <Card style={{ borderRadius: "var(--r1)" }}>
        <Hint style={{ fontSize: 18 }}>Optional. Used for "show me" missions.</Hint>
        <div className="q-chips">
          {spotsFor(station.id).map((s) => (
            <Chip key={s.id} selected={picked.includes(s.id)} onToggle={() => toggle(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
        <Eyebrow style={{ marginTop: 8 }}>Ask me about (optional)</Eyebrow>
        <TextField
          label="Ask me about (optional)"
          value={d.askMeAbout ?? ""}
          onChange={(askMeAbout) => actions.updateDraft({ askMeAbout })}
          placeholder="e.g. the best bowl in Allston"
          maxLength={60}
        />
      </Card>
    </Screen>
  );
}
