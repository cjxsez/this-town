import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, ButtonRow, Card, Chip, Eyebrow, Screen } from "../../ui";
import { useApp } from "../../state/store";
import { INTEREST_CATEGORIES, INTERESTS, type InterestCategory } from "../../../shared/catalog";
import { JoinSteps, JoinTitle } from "./parts";

const MIN = 3;
const FEATURED = INTERESTS.filter((i) => i.featured);

/**
 * B3 Interests. Chips only, no free text, so every pick is a catalog id the
 * matcher can compare. Featured chips up top; each category opens its extras.
 */
export default function Interests() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const picked = state.draft.interests ?? [];
  // Open any category that already holds a pick, so coming back shows it.
  const [open, setOpen] = useState<InterestCategory[]>(() =>
    INTEREST_CATEGORIES.filter((c) => INTERESTS.some((i) => !i.featured && i.category === c && picked.includes(i.id))),
  );

  const toggle = (id: string) =>
    actions.updateDraft({ interests: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });
  const toggleCat = (c: InterestCategory) => setOpen((o) => (o.includes(c) ? o.filter((x) => x !== c) : [...o, c]));

  return (
    <Screen
      label="B3"
      blobs="c"
      footer={
        <ButtonRow>
          <Button tilt={0.5} disabled={picked.length < MIN} onClick={() => navigate("/join/spots")}>
            Next · {picked.length} picked
          </Button>
        </ButtonRow>
      }
    >
      <JoinSteps step={2} />
      <JoinTitle>Tap a few things you'd talk about</JoinTitle>
      <Card>
        <Eyebrow>Pick 3 or more</Eyebrow>
        <div className="q-chips">
          {FEATURED.map((i, n) => (
            <Chip key={i.id} index={n} selected={picked.includes(i.id)} onToggle={() => toggle(i.id)}>
              {i.label}
            </Chip>
          ))}
        </div>

        <Eyebrow style={{ marginTop: 8 }}>More by category</Eyebrow>
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: 6 }}>
          {INTEREST_CATEGORIES.map((c) => {
            const isOpen = open.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`cat-${c}`}
                onClick={() => toggleCat(c)}
                style={{ minHeight: 44, display: "flex", alignItems: "center" }}
              >
                <span className="q-pill" style={isOpen ? { background: "var(--sky)" } : undefined}>
                  {c} {isOpen ? "▴" : "▾"}
                </span>
              </button>
            );
          })}
        </div>

        {open.map((c) => (
          <div key={c} id={`cat-${c}`} className="anim-fadeIn" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Eyebrow>{c}</Eyebrow>
            <div className="q-chips">
              {INTERESTS.filter((i) => i.category === c && !i.featured).map((i, n) => (
                <Chip key={i.id} index={n} selected={picked.includes(i.id)} onToggle={() => toggle(i.id)}>
                  {i.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </Screen>
  );
}
