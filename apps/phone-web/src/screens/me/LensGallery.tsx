import type { LensCard as LensCardValue } from "../../../shared/types";
import { BackLink, Body, Card, Eyebrow, Screen, Title } from "../../ui";
import { LensCard } from "./LensCard";

// Sample values for every card the glasses show, in ride order.
const SAMPLES: { label: string; card: LensCardValue }[] = [
  { label: "Link", card: { kind: "link", code: "4821" } },
  { label: "Riding", card: { kind: "riding", nextStop: "Hynes", nextIn: "3 min", riders: 4 } },
  { label: "Match", card: { kind: "match", name: "Maya", color: "orange", where: "Kiosk 1 car forward", why: "You both like ramen and film" } },
  { label: "Mission", card: { kind: "mission", title: "Rename Hynes", left: "2 min left", tapped: 1 } },
  { label: "Stamp", card: { kind: "stamp", station: "Hynes", name: "Maya" } },
];

export default function LensGallery() {
  return (
    <Screen label="L" blobs="b">
      <div style={{ alignSelf: "flex-start" }}>
        <BackLink to="/me">Me</BackLink>
      </div>
      <Title size="md">Every lens card, in order</Title>
      <Card ink flat style={{ fontSize: 19, lineHeight: 1.2 }}>
        Title, one body line, a coarse timer. No buttons: the glasses work with no input. Never: a list of riders, a map,
        a face, or a last name.
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
