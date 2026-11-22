import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PAIR_COLOR_HEX } from "@questline/protocol/colors";
import { Body, Button, ButtonRow, Card, Hint, Screen } from "../../ui";
import { useApp } from "../../state/store";
import { shortDate } from "../../state/format";
import { stationById } from "../../../shared/catalog";
import { PaperBack } from "./parts";

const LIGHT = new Set(["yellow", "green", "orange"]);

export default function Person() {
  const { personId } = useParams();
  const { state, actions } = useApp();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const p = state.people.find((x) => x.id === personId && !x.blocked);

  if (!p) {
    return (
      <Screen tabs blobs="b" label="H5">
        <PaperBack to="/people">PEOPLE</PaperBack>
        <Card>
          <Body>This person isn't in your list.</Body>
        </Card>
      </Screen>
    );
  }

  const station = stationById(p.metAtStationId)?.name ?? "the T";

  const block = () => {
    void actions.block(p.id);
    navigate("/people", { replace: true });
  };

  return (
    <Screen tabs blobs="b" label="H5">
      <PaperBack to="/people">PEOPLE</PaperBack>

      <div className="cl-hero">
        <div
          className="cl-hero__art"
          style={{ background: PAIR_COLOR_HEX[p.color], color: LIGHT.has(p.color) ? "var(--ink)" : "var(--paper)", display: "grid", placeItems: "center", font: "400 48px var(--font-display)" }}
          aria-hidden
        >
          {p.firstName.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="q-eyebrow" style={{ color: "var(--onsea)" }}>
            Pair color · {p.color}
          </div>
          <h1 className="cl-hero__name">{p.firstName.toUpperCase()}</h1>
          <p className="cl-hero__meta">
            Met {p.metAtStationId ? `at ${station} · ` : ""}
            {shortDate(p.metAt)} · {p.quests > 0 ? `${p.quests} stamp${p.quests === 1 ? "" : "s"}` : "no stamp yet"}
          </p>
        </div>
      </div>

      {confirming ? (
        <Card>
          <div role="alertdialog" aria-labelledby="cl-block-q" aria-describedby="cl-block-d" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div id="cl-block-q" style={{ font: "700 25px/1.08 var(--font-hand)" }}>
              Block {p.firstName}?
            </div>
            <Hint style={{ margin: 0 }}>
              <span id="cl-block-d">
                {p.firstName} leaves your list and won't be matched with you again. They aren't told.
              </span>
            </Hint>
            <ButtonRow>
              <Button variant="secondary" onClick={() => setConfirming(false)} autoFocus>
                Cancel
              </Button>
              <Button variant="danger" onClick={block}>
                Block
              </Button>
            </ButtonRow>
          </div>
        </Card>
      ) : (
        <ButtonRow>
          <Button variant="secondary" to={`/people/${p.id}/report`}>
            Report
          </Button>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Block
          </Button>
        </ButtonRow>
      )}
    </Screen>
  );
}
