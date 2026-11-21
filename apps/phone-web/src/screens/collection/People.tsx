import { Link } from "react-router";
import { AnimalToken, Body, Button, Card, Screen } from "../../ui";
import { useApp } from "../../state/store";
import { shortDate } from "../../state/format";
import { stationById } from "../../../shared/catalog";
import type { Person } from "../../../shared/types";
import "./collection.css";

function Status({ p }: { p: Person }) {
  if (p.stayInTouch === "waiting") return <span className="q-pill" style={{ background: "var(--yellow)" }}>WAITING</span>;
  if (p.stayInTouch === "connected") {
    const h = p.handles?.instagram ?? p.handles?.snapchat;
    if (h) return <span className="cl-person__handle">@{h}</span>;
  }
  return (
    <span className="cl-person__handle" style={{ fontSize: 22, color: "var(--ink-soft)" }} aria-label="not in touch">
      —
    </span>
  );
}

export default function People() {
  const { state } = useApp();
  const people = state.people.filter((p) => !p.blocked).sort((a, b) => b.metAt.localeCompare(a.metAt));

  return (
    <Screen tabs blobs="c" label="H4">
      <h1 className="cl-h1" style={{ fontSize: 24 }}>
        PEOPLE YOU'VE MET
      </h1>

      {people.length === 0 ? (
        <Card>
          <Body>Nobody yet. The riders you play a quest with show up here.</Body>
          <Button to="/ride">Start a ride</Button>
        </Card>
      ) : (
        <>
          <Card className="cl-people">
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {people.map((p) => (
                <li key={p.id}>
                  <Link to={`/people/${p.id}`} className="cl-person">
                    <AnimalToken badge={p.badge} size={54} />
                    <span className="cl-person__text">
                      <span className="cl-person__name">{p.firstName}</span>
                      <span className="cl-person__where">
                        {stationById(p.metAtStationId)?.name ?? "the T"} · {shortDate(p.metAt)}
                      </span>
                    </span>
                    <Status p={p} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <p className="q-body" style={{ margin: 0 }}>
            Handles appear only when you both turned on Stay in touch. "Waiting" means you did; we don't tell you if they haven't.
          </p>
        </>
      )}
    </Screen>
  );
}
