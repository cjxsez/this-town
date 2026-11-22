import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArtSlot, Body, Button, ButtonRow, Card, Hint, Screen, Toggle } from "../../ui";
import { useApp } from "../../state/store";
import { pron, shortDate } from "../../state/format";
import { BADGE_COLORS, badgeName, stationById } from "../../../shared/catalog";
import type { Person as PersonT } from "../../../shared/types";
import { PaperBack } from "./parts";

const LIGHT = new Set(["yellow", "blue"]);

function handleLine(p: PersonT): string {
  if (p.stayInTouch === "connected") {
    const parts = [
      p.handles?.instagram && `Instagram @${p.handles.instagram}`,
      p.handles?.snapchat && `Snapchat @${p.handles.snapchat}`,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "You're both in touch.";
  }
  if (p.stayInTouch === "waiting") return `Instagram, Snapchat: hidden until ${p.firstName} turns it on`;
  return "Instagram, Snapchat: hidden until you both turn it on";
}

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

  const pr = pron(p.pronoun);
  const station = stationById(p.metAtStationId)?.name ?? "the T";
  const isConnected = p.stayInTouch === "connected";

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
          style={{ background: BADGE_COLORS[p.badge.color], color: LIGHT.has(p.badge.color) ? "var(--ink)" : "var(--paper)" }}
          aria-hidden
        >
          <ArtSlot
            id={`animal-${p.badge.animal}`}
            fit="contain"
            placeholder={`${badgeName(p.badge)} art`}
            round
            style={{ width: "100%", height: "100%", color: "inherit", background: "rgba(38,52,59,.18)" }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="q-eyebrow" style={{ color: "var(--onsea)" }}>
            {badgeName(p.badge)}
          </div>
          <h1 className="cl-hero__name">{p.firstName.toUpperCase()}</h1>
          <p className="cl-hero__meta">
            Met at {station} · {shortDate(p.metAt)} · {p.quests} quest{p.quests === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {p.askMeAbout && (
        <Card style={{ gap: 6 }}>
          <div className="q-eyebrow">ASK {pr.obj.toUpperCase()} ABOUT</div>
          <div className="cl-q">{p.askMeAbout}</div>
        </Card>
      )}

      <Card>
        <div className="cl-touch">
          <span className="cl-touch__label" id="cl-touch-label">
            Stay in touch
          </span>
          <Toggle
            checked={p.stayInTouch !== "off"}
            onChange={(on) => void actions.setStayInTouch(p.id, on)}
            label={`Stay in touch with ${p.firstName}`}
          />
        </div>
        <Hint style={{ margin: 0, color: isConnected ? "var(--ink)" : undefined, fontWeight: isConnected ? 700 : undefined }}>
          {handleLine(p)}
        </Hint>
      </Card>

      {confirming ? (
        <Card>
          <div role="alertdialog" aria-labelledby="cl-block-q" aria-describedby="cl-block-d" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div id="cl-block-q" style={{ font: "700 25px/1.08 var(--font-hand)" }}>
              Block {p.firstName}?
            </div>
            <Hint style={{ margin: 0 }}>
              <span id="cl-block-d">
                {p.firstName} leaves your list and won't be matched with you again. {pr.Subj} {p.pronoun === "they" ? "aren't" : "isn't"} told.
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
