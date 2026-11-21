import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { ReportReason } from "../../../shared/types";
import { pron } from "../../state/format";
import { useApp } from "../../state/store";
import { Body, Button, Card, Checkbox, Radio, Screen, TextField, Title } from "../../ui";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "uncomfortable", label: "Made me uncomfortable" },
  { id: "didntStop", label: "Didn't stop when I left" },
  { id: "photoWithoutAsking", label: "Took a photo without asking" },
  { id: "other", label: "Something else" },
];

const backChip = {
  alignSelf: "flex-start",
  minHeight: 44,
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  background: "var(--paper)",
  color: "var(--ink)",
  border: "var(--ol) solid var(--ink)",
  borderRadius: "var(--r3)",
  boxShadow: "3px 5px 0 var(--shadow)",
  filter: "var(--wob)",
  rotate: "-0.4deg",
  font: "400 13px var(--font-display)",
  cursor: "pointer",
} as const;

export default function Report() {
  const { personId = "" } = useParams();
  const { state, actions } = useApp();
  const navigate = useNavigate();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [other, setOther] = useState(""); // stays on this phone; the API takes a reason id only
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Reachable from People and from a live quest, so fall back to the current match.
  const m = state.ride.match;
  const person = state.people.find((p) => p.id === personId) ?? (m?.id === personId ? m : undefined);
  const name = person?.firstName ?? "this rider";
  const p = pron(person?.pronoun ?? "they");

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/me"));

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      await actions.report(personId, reason, alsoBlock);
    } finally {
      setSending(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Screen label="I2" blobs="c" footer={<Button to="/people">Back to People</Button>}>
        <Title style={{ fontSize: 46, marginTop: 40 }}>Thanks for telling us.</Title>
        <Body style={{ fontSize: 22 }}>
          We'll look at it. {p.Subj} won't be told who reported.
          {alsoBlock && ` You won't be matched with ${p.obj} again.`}
        </Body>
        <EmergencyCard />
      </Screen>
    );
  }

  return (
    <Screen
      label="I2"
      blobs="c"
      footer={
        <Button onClick={send} disabled={!reason || sending} tilt={0.8}>
          {sending ? "Sending…" : "Send report"}
        </Button>
      }
    >
      <button type="button" onClick={back} style={backChip}>
        ← BACK
      </button>
      <Title style={{ fontSize: 46 }}>Report {name}</Title>
      <Body style={{ fontSize: 22 }}>{p.Subj} won't be told who reported.</Body>
      <Card style={{ gap: 0 }}>
        <div role="radiogroup" aria-label="What happened">
          {REASONS.map((r) => (
            <Radio key={r.id} checked={reason === r.id} onSelect={() => setReason(r.id)}>
              <span style={{ font: "700 22px/1.05 var(--font-hand)" }}>{r.label}</span>
            </Radio>
          ))}
        </div>
        {reason === "other" && (
          <div style={{ marginTop: 6 }}>
            <TextField value={other} onChange={setOther} label="What happened (optional)" placeholder="a few words (optional)" maxLength={140} autoFocus />
          </div>
        )}
      </Card>
      <Checkbox checked={alsoBlock} onChange={setAlsoBlock}>
        Also block {p.obj}
      </Checkbox>
      <EmergencyCard />
    </Screen>
  );
}

function EmergencyCard() {
  return (
    <div
      style={{
        background: "var(--ink)",
        color: "var(--paper)",
        borderRadius: "var(--r1)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 19,
        lineHeight: 1.2,
      }}
    >
      <div style={{ font: "400 11px var(--font-display)", letterSpacing: ".06em", color: "var(--yellow)" }}>IN DANGER RIGHT NOW?</div>
      <div>Use the blue emergency call boxes on the platform or call Transit Police.</div>
      <a
        href="tel:+16172221212"
        aria-label="Call MBTA Transit Police, 617-222-1212"
        style={{
          alignSelf: "flex-start",
          minHeight: 44,
          display: "inline-flex",
          alignItems: "center",
          color: "var(--yellow)",
          font: "700 21px var(--font-hand)",
          textDecoration: "underline",
          textUnderlineOffset: 4,
        }}
      >
        <span>
          Call Transit Police <span style={{ whiteSpace: "nowrap" }}>617-222-1212</span>
        </span>
      </a>
    </div>
  );
}
