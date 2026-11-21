import { AnimalToken, ArtSlot, Button, Card, Eyebrow, Screen, TextLink } from "../../ui";
import { useRide } from "../../state/store";
import { badgeName } from "../../../shared/catalog";
import { MeetTopBar } from "./parts/MeetTopBar";

// E1: sent only after two yeses. Never a map, a distance or a dot: just the
// landmark, the badge to look for and the opening line.
export default function Meet() {
  const { ride, act, profile } = useRide();
  const { match, meetSpot, opener } = ride;
  if (!match || !meetSpot) return null;
  const stationId = ride.checkIn?.stationId ?? "station";
  const youFirst = opener?.youFirst ?? true;
  const quote = opener ? (youFirst ? opener.say : opener.listenFor) : undefined;

  return (
    <Screen
      label="E1"
      blobs="b"
      footer={
        <>
          <Button tilt={0.8} onClick={act.met} style={{ minHeight: 60 }}>
            We met
          </Button>
          <TextLink onClick={act.cantSpot}>Can't spot them?</TextLink>
        </>
      }
    >
      <MeetTopBar />

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <AnimalToken
          badge={match.badge}
          size={104}
          style={{ borderWidth: 3, boxShadow: "3px 5px 0 var(--shadow)", fontSize: 14 }}
        />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ font: "400 30px/1.02 var(--font-display)", textTransform: "uppercase" }}>Meet {match.firstName}</h1>
          <div style={{ fontSize: 21, lineHeight: 1.2, marginTop: 6, textWrap: "pretty" }}>
            Look for the <b>{badgeName(match.badge)}</b> badge
          </div>
          {profile.badge && <div style={{ fontSize: 18, lineHeight: 1.2 }}>You're the {badgeName(profile.badge)}</div>}
        </div>
      </div>

      <Card style={{ rotate: "0.5deg", gap: 8, borderRadius: "var(--r1)" }}>
        <Eyebrow>Meet at</Eyebrow>
        <div
          style={{
            height: 128,
            flex: "none",
            border: "var(--ol) solid var(--ink)",
            borderRadius: 4,
            overflow: "hidden",
            background: "#C9D6CF",
          }}
        >
          {meetSpot.photo ? (
            <img src={meetSpot.photo} alt={`${meetSpot.name}, ${meetSpot.detail}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <ArtSlot
              id={`meet-spot-${stationId}-${meetSpot.id}`}
              placeholder={`photo: ${meetSpot.name.toLowerCase()}, ${meetSpot.detail}`}
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          )}
        </div>
        <div style={{ font: "700 22px/1.08 var(--font-hand)" }}>
          {meetSpot.name} · {meetSpot.detail}
        </div>
      </Card>

      {quote && (
        <Card style={{ rotate: "-0.4deg", gap: 6, borderRadius: "var(--r2)" }}>
          <Eyebrow>{youFirst ? "You go first. Say:" : "They go first. Listen for:"}</Eyebrow>
          <div style={{ font: "700 31px/1.03 var(--font-hand)", textWrap: "balance" }}>"{quote}"</div>
        </Card>
      )}
    </Screen>
  );
}
