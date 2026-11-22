import { useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { INTERESTS } from "../../../shared/catalog";
import type { SocialBattery, TimeOfDay } from "../../../shared/types";
import { sim } from "../../api";
import { useApp } from "../../state/store";
import { Button, ButtonRow, Card, Chip, Hint, PairToken, Screen, Segmented, TextField, Toggle, TileTitle } from "../../ui";

const BATTERY: { value: SocialBattery; label: string }[] = [
  { value: "nod", label: "Nod" },
  { value: "chat", label: "Chat" },
  { value: "talk", label: "Talk" },
];
const TIMES: { value: TimeOfDay; label: string }[] = [
  { value: "Day", label: "Day" },
  { value: "Dusk", label: "Dusk" },
  { value: "Night", label: "Night" },
];

const subPanel: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, padding: "10px 0 14px", borderBottom: "2px dashed var(--stone)" };
const subRow: CSSProperties = { display: "flex", alignItems: "center", gap: 10, minHeight: 48, font: "700 21px var(--font-hand)", color: "var(--ink)", textDecoration: "none" };
const smallBtn: CSSProperties = { flex: "none", minHeight: 44, fontSize: 13, padding: "4px 12px" };

function Chevron({ open }: { open?: boolean }) {
  return (
    <span aria-hidden style={{ display: "inline-block", transition: "rotate .15s", rotate: open ? "90deg" : "0deg" }}>
      ›
    </span>
  );
}

function Row({ label, value, open, onClick, controls }: { label: string; value?: ReactNode; open: boolean; onClick: () => void; controls: string }) {
  return (
    <button type="button" className="q-row" aria-expanded={open} aria-controls={controls} onClick={onClick}>
      <span>{label}</span>
      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {value}
        <Chevron open={open} />
      </span>
    </button>
  );
}

function ToggleRow({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48 }}>
      <div>
        <div style={{ font: "700 22px/1.08 var(--font-hand)" }}>{title}</div>
        {sub && <div style={{ fontSize: 16, lineHeight: 1.2, color: "var(--ink-soft)" }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

type Panel = "blocked" | "report" | "edit" | null;

export default function Me() {
  const { state, actions } = useApp();
  const navigate = useNavigate();
  const { settings, profile } = state;
  const [panel, setPanel] = useState<Panel>(null);
  const [confirm, setConfirm] = useState<"delete" | "signout" | null>(null);
  const [deleting, setDeleting] = useState(false);

  const blocked = state.people.filter((p) => p.blocked);
  const reportable = state.people.filter((p) => !p.blocked);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  const del = async () => {
    setDeleting(true);
    try {
      await actions.deleteMyData();
    } finally {
      navigate("/", { replace: true });
    }
  };

  const signOut = async () => {
    setDeleting(true);
    try {
      await actions.signOut();
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <Screen label="I1" tabs blobs="b">
      <TileTitle text="SAFETY & PRIVACY" />

      <Card style={{ borderRadius: "var(--r2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="q-title--md">Ghost mode</div>
          <Toggle large checked={settings.ghost} onChange={(ghost) => actions.setSettings({ ghost })} label="Ghost mode" />
        </div>
        <div style={{ fontSize: 18, lineHeight: 1.2, color: "var(--ink-soft)" }}>Ride Mode stays on, but nobody is matched with you. Turn it off when you're up for it again.</div>
      </Card>

      <Card style={{ gap: 0, padding: "2px 16px" }}>
        <Row label="Blocked people" value={blocked.length} open={panel === "blocked"} onClick={() => toggle("blocked")} controls="me-blocked" />
        {panel === "blocked" && (
          <div id="me-blocked" style={subPanel}>
            {blocked.length === 0 && <Hint>Nobody blocked.</Hint>}
            {blocked.map((p) => (
              <div key={p.id} style={subRow}>
                <PairToken color={p.color} name={p.firstName} size={36} />
                <span style={{ flex: 1 }}>{p.firstName}</span>
                <Button variant="secondary" style={smallBtn} onClick={() => actions.unblock(p.id)} aria-label={`Unblock ${p.firstName}`}>
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}

        <Row label="Report something" open={panel === "report"} onClick={() => toggle("report")} controls="me-report" />
        {panel === "report" && (
          <div id="me-report" style={subPanel}>
            <Hint>Who is it about?</Hint>
            {reportable.length === 0 && (
              <Link to="/people" style={subRow}>
                Go to People ›
              </Link>
            )}
            {reportable.map((p) => (
              <Link key={p.id} to={`/people/${p.id}/report`} style={subRow}>
                <PairToken color={p.color} name={p.firstName} size={36} />
                <span style={{ flex: 1 }}>{p.firstName}</span>
                <span aria-hidden>›</span>
              </Link>
            ))}
          </div>
        )}

        <Row label="Edit profile & interests" open={panel === "edit"} onClick={() => toggle("edit")} controls="me-edit" />
        {panel === "edit" && profile && <ProfileEditor key={profile.id} onDone={() => setPanel(null)} />}

        <Link to="/me/glasses" className="q-row">
          <span>Glasses</span>
          <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 18, color: "var(--ink-soft)" }}>{profile?.glassesLinked ? "linked" : "not linked"}</span>
            <Chevron />
          </span>
        </Link>
      </Card>

      <div style={{ background: "var(--ink)", color: "var(--paper)", borderRadius: "var(--r4)", padding: "14px 16px", fontSize: 19, lineHeight: 1.2 }}>
        No camera, no microphone, no GPS. We only know which kiosk you tapped, and only while Ride Mode is on. First names only.
      </div>

      {confirm === null && (
        <ButtonRow>
          <Button variant="secondary" onClick={() => setConfirm("signout")}>
            Sign out
          </Button>
          <Button variant="danger" onClick={() => setConfirm("delete")}>
            Delete my data
          </Button>
        </ButtonRow>
      )}
      {confirm === "signout" && (
        <Card>
          <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="q-title--sm">Sign out?</div>
            <div style={{ fontSize: 18, lineHeight: 1.2, color: "var(--ink-soft)" }}>
              {profile?.email
                ? `Ride Mode turns off on this phone. Sign back in with ${profile.email} anytime and your stamps and people are still there.`
                : "You're playing as a guest, so there's no way back in: your stamps and people stay behind. Ride Mode turns off."}
            </div>
          </div>
          <ButtonRow>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={deleting}>
              Stay
            </Button>
            <Button onClick={signOut} disabled={deleting}>
              {deleting ? "Signing out…" : "Sign out"}
            </Button>
          </ButtonRow>
        </Card>
      )}
      {confirm === "delete" && (
        <Card>
          <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="q-title--sm">Delete everything?</div>
            <div style={{ fontSize: 18, lineHeight: 1.2, color: "var(--ink-soft)" }}>
              Ride Mode turns off, every device is signed out, and your profile, stamps and people go, here and on our server. This can't be undone.
            </div>
          </div>
          <ButtonRow>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="danger" onClick={del} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </ButtonRow>
        </Card>
      )}

      <Card style={{ borderRadius: "var(--r3)" }}>
        <div className="q-eyebrow">LOOK &amp; FEEL</div>
        <div style={{ font: "700 20px var(--font-hand)" }}>Time of day</div>
        <Segmented label="Time of day" options={TIMES} value={settings.timeOfDay} onChange={(timeOfDay) => actions.setSettings({ timeOfDay })} />
        <ToggleRow title="Hand-drawn" sub="Wobbly outlines and ragged foam">
          <Toggle checked={settings.handDrawn} onChange={(handDrawn) => actions.setSettings({ handDrawn })} label="Hand-drawn" />
        </ToggleRow>
        <ToggleRow title="Motion" sub="Floating trains and little bounces">
          <Toggle checked={settings.motion} onChange={(motion) => actions.setSettings({ motion })} label="Motion" />
        </ToggleRow>
        {sim && (
          <ToggleRow title="Show demo panel" sub="Simulator controls, demo builds only">
            <Toggle checked={settings.demoPanel} onChange={(demoPanel) => actions.setSettings({ demoPanel })} label="Show demo panel" />
          </ToggleRow>
        )}
      </Card>

    </Screen>
  );
}

function ProfileEditor({ onDone }: { onDone: () => void }) {
  const { state, actions } = useApp();
  const profile = state.profile!;
  const [firstName, setFirstName] = useState(profile.firstName);
  const [battery, setBattery] = useState<SocialBattery>(profile.battery);
  const [interests, setInterests] = useState<string[]>(profile.interests);

  // Featured chips plus anything already picked, so the list stays short.
  const shown = INTERESTS.filter((i) => i.featured || profile.interests.includes(i.id));
  const flip = (id: string) => setInterests((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const name = firstName.trim();

  const save = () => {
    actions.updateProfile({ firstName: name, battery, interests });
    onDone();
  };

  return (
    <div id="me-edit" style={{ ...subPanel, gap: 10 }}>
      <TextField label="First name" value={firstName} onChange={setFirstName} maxLength={20} placeholder="First name" autoComplete="given-name" />
      <Segmented label="Social battery" options={BATTERY} value={battery} onChange={setBattery} />
      <div className="q-chips" role="group" aria-label="Interests">
        {shown.map((i) => (
          <Chip key={i.id} selected={interests.includes(i.id)} onToggle={() => flip(i.id)}>
            {i.label}
          </Chip>
        ))}
      </div>
      <ButtonRow>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!name}>
          Save
        </Button>
      </ButtonRow>
    </div>
  );
}
