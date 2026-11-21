import type { LensCard as LensCardValue } from "../../../shared/types";
import { BackLink, Body, Card, Eyebrow, Screen, Title } from "../../ui";
import { LensCard } from "./LensCard";

// The design's sample values, so the gallery reads like the L1–L7 boards.
const SAMPLES: { label: string; card: LensCardValue }[] = [
  { label: "Waiting", card: { kind: "waiting", line: "Green B", direction: "Westbound", trainIn: "4:10" } },
  { label: "Private offer", card: { kind: "offer", why: "Someone here also loves ramen", minutes: 3 } },
  { label: "Meet up", card: { kind: "meet", name: "Maya", badge: "Teal fox", spot: "At the system map", train: "3:00" } },
  { label: "Greeting", card: { kind: "greeting", name: "Maya", opener: "Is this the train to Narnia?", train: "2:30" } },
  { label: "Mission", card: { kind: "mission", title: "Rename Kenmore together", left: "2 min left", train: "3:10" } },
  { label: "Bump + stamp", card: { kind: "stamp", station: "Kenmore", name: "Maya", askPhoto: true } },
  { label: "Train coming", card: { kind: "trainSoon", seconds: 30 } },
];

export default function LensGallery() {
  return (
    <Screen label="L" blobs="b">
      <div style={{ alignSelf: "flex-start" }}>
        <BackLink to="/me">Me</BackLink>
      </div>
      <Title size="md">All seven lens cards, in order</Title>
      <Card ink flat style={{ fontSize: 19, lineHeight: 1.2 }}>
        Title, one body line, a coarse timer, at most two buttons. Every update replaces the whole card. Never: a list of
        riders, a map, a face, or anything about someone who hasn't said yes.
      </Card>
      <Body style={{ fontSize: 17 }}>
        Right eye, 600×600. Timers only redraw at 2:00, 1:00, 0:30 and 0:10.
      </Body>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
        {SAMPLES.map((s, i) => (
          <li key={s.label} style={{ display: "flex", flexDirection: "column", gap: 10, width: 304 }}>
            <Eyebrow style={{ color: "var(--onsea)", fontSize: 13 }}>
              {i + 1} · {s.label}
            </Eyebrow>
            <LensCard card={s.card} />
          </li>
        ))}
      </ol>
    </Screen>
  );
}
