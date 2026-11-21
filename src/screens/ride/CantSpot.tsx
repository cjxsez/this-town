import { AnimalToken, Button, Card, Eyebrow, Screen, TextLink } from "../../ui";
import { useRide } from "../../state/store";
import { useNow } from "../../state/useNow";
import { pron } from "../../state/format";
import { badgeName } from "../../../shared/catalog";
import { MeetTopBar } from "./parts/MeetTopBar";

/** "20 s ago" / "2 min ago". */
function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  return `${Math.floor(s / 60)} min ago`;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// E2: never a map dot or a distance. "I'm at the spot" sends one fixed line
// and nothing else. Calling it off shows both riders the neutral D3.
export default function CantSpot() {
  const { ride, act, profile } = useRide();
  const now = useNow();
  const { match, meetSpot } = ride;
  if (!match || !meetSpot) return null;
  const p = pron(match.pronoun);
  const spot = lowerFirst(meetSpot.name);
  const sentLine = `"${profile.firstName} is at ${spot}."`;

  return (
    <Screen
      label="E2"
      blobs="c"
      footer={
        <>
          <Button variant="secondary" tilt={-0.7} onClick={act.withdraw}>
            Call it off, no hard feelings
          </Button>
          <TextLink small onClick={act.backToMeet}>
            Found {p.obj}? Back to the meet card
          </TextLink>
        </>
      }
    >
      <MeetTopBar />
      <h1 style={{ font: "700 44px/1.03 var(--font-hand)", textWrap: "balance" }}>Can't spot {match.firstName}?</h1>
      <p style={{ fontSize: 21, lineHeight: 1.2, textWrap: "pretty" }}>
        {p.is.charAt(0).toUpperCase() + p.is.slice(1)} heading to the same spot. Look for a {badgeName(match.badge)} badge at chest height.
      </p>

      {/* Decorative only: the dot walks on a loop, or sits at the spot once you've said so. It is not a position. */}
      <div style={{ flex: 1, minHeight: 80, display: "flex", alignItems: "center" }} aria-hidden>
        <div
          style={{
            width: "100%",
            minHeight: 58,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            background: "var(--paper)",
            color: "var(--ink)",
            border: "var(--ol) solid var(--ink)",
            borderRadius: "var(--r2)",
            font: "400 11px var(--font-display)",
            letterSpacing: ".05em",
            textTransform: "uppercase",
          }}
        >
          <span>You</span>
          <div style={{ flex: 1, height: 0, borderTop: "3px dashed var(--ink)", position: "relative", margin: "0 14px" }}>
            <span
              className={ride.youAtSpot ? undefined : "anim-walk"}
              style={{
                position: "absolute",
                top: -10,
                left: ride.youAtSpot ? "calc(100% - 16px)" : 0,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--orange)",
                border: "var(--ol) solid var(--ink)",
              }}
            />
          </div>
          <span
            style={{
              flex: "none",
              width: 14,
              height: 14,
              background: "var(--yellow)",
              border: "var(--ol) solid var(--ink)",
              rotate: "45deg",
              marginRight: 10,
            }}
          />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "45%" }}>{spot.replace(/^the /, "")}</span>
        </div>
      </div>

      {ride.youAtSpot ? (
        <Button variant="leaf" tilt={-0.5} disabled aria-live="polite" style={{ flex: "none", opacity: 1, filter: "var(--wob)", cursor: "default" }}>
          ✓ Sent to {match.firstName}
        </Button>
      ) : (
        <Button tilt={-0.5} onClick={act.atSpot} style={{ flex: "none" }}>
          I'm at the spot
        </Button>
      )}
      <p style={{ fontSize: 17, lineHeight: 1.2, textWrap: "pretty" }}>
        {ride.youAtSpot ? "Sent" : "Sends"} {match.firstName} {sentLine} Nothing about where you are beyond that.
      </p>

      <Card style={{ rotate: "0.6deg", borderRadius: "var(--r4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AnimalToken badge={match.badge} size={46} style={{ fontSize: 9 }} />
          <div>
            <Eyebrow>{match.firstName}</Eyebrow>
            <div style={{ font: "700 22px/1.08 var(--font-hand)" }}>
              {ride.partnerAtSpotAt !== undefined ? `✓ at the spot · ${ago(ride.partnerAtSpotAt, now)}` : "on the way"}
            </div>
          </div>
        </div>
      </Card>
    </Screen>
  );
}
