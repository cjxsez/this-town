import { AnimalToken, Button, Card, Eyebrow, Screen } from "../../ui";
import { useRide } from "../../state/store";
import { MeetTopBar } from "./parts/MeetTopBar";

// E3: the scripted password. Without glasses, either rider tapping We met
// lands here minus the ✓ line. The mission timer starts at F1.
export default function Greeting() {
  const { ride, act, profile } = useRide();
  const { match, opener } = ride;
  if (!match) return null;
  const glasses = ride.badgeVerified && profile.hasGlasses;

  return (
    <Screen
      label="E3"
      blobs="b"
      footer={
        <Button tilt={0.8} onClick={act.startQuest}>
          Start the quest
        </Button>
      }
    >
      <MeetTopBar />
      <h1 style={{ font: "700 50px/1.03 var(--font-hand)", textWrap: "balance" }}>That's {match.firstName} ✓</h1>
      {glasses && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="q-pill" style={{ background: "var(--sky)" }}>
            Glasses
          </span>
          <span style={{ fontSize: 20, lineHeight: 1.2 }}>Badge read by your glasses</span>
        </div>
      )}
      {opener && (
        <>
          <Card style={{ rotate: "0.5deg", gap: 6, marginRight: 34, borderRadius: "var(--r1)" }}>
            <Eyebrow>You say</Eyebrow>
            <div style={{ font: "700 31px/1.03 var(--font-hand)", textWrap: "balance" }}>"{opener.say}"</div>
          </Card>
          <Card style={{ rotate: "-0.4deg", gap: 6, marginLeft: 34, background: "var(--ticket)", borderRadius: "var(--r2)" }}>
            <Eyebrow>Listen for</Eyebrow>
            <div style={{ font: "700 31px/1.03 var(--font-hand)", textWrap: "balance" }}>"{opener.listenFor}"</div>
          </Card>
          <p style={{ fontSize: 19, lineHeight: 1.2, textAlign: "center", textWrap: "pretty" }}>
            If you hear it, you've got the right person.
          </p>
        </>
      )}
      <div style={{ flex: 1, minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center", gap: 26 }} aria-hidden>
        {profile.badge && <AnimalToken badge={profile.badge} size={76} style={{ fontSize: 15 }} />}
        <AnimalToken badge={match.badge} size={76} style={{ fontSize: 15 }} />
      </div>
    </Screen>
  );
}
