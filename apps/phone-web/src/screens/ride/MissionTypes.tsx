import { BackLink, Card, Screen } from "../../ui";
import { MISSIONS, MISSION_GROUP_LABEL, missionText } from "../../../shared/catalog";
import type { Mission } from "../../../shared/types";
import "./parts/MissionScreen.css";

const GROUPS = Object.keys(MISSION_GROUP_LABEL) as Mission["group"][];
const fill = (s: string) => missionText(s, { name: "Maya" });
const example = (s: string) => fill(s).replace(/[.]$/, "");
const secs = (s: number) => (s >= 120 && s % 60 === 0 ? `${s / 60} min` : `${s} s`);

// F2: reference sheet, not part of the ride flow.
export default function MissionTypes() {
  return (
    <Screen label="F2" blobs="c">
      <div>
        <BackLink to="/ride">Ride</BackLink>
      </div>
      <Card className="mission-types" style={{ padding: "24px 24px 26px", gap: 14, borderRadius: "var(--r4)" }}>
        <h1 style={{ font: "400 15px/1.02 var(--font-display)" }}>5 MISSION GROUPS ({MISSIONS.length} TOTAL)</h1>
        {GROUPS.map((g) => {
          const list = MISSIONS.filter((m) => m.group === g);
          const late = g === "lateBonus";
          return (
            <section key={g}>
              <h2 className="q-eyebrow" style={late ? { color: "var(--brick)" } : undefined}>
                {MISSION_GROUP_LABEL[g]}
              </h2>
              <div style={{ font: "700 25px/1.08 var(--font-hand)", marginTop: 3 }}>{example(list[0].title)}</div>
              <details style={{ marginTop: 2 }}>
                <summary
                  style={{
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    font: "700 17px var(--font-hand)",
                    color: "var(--ink-soft)",
                    textDecoration: "underline",
                    textUnderlineOffset: 4,
                    listStyle: "none",
                  }}
                >
                  All {list.length} in this group ▾
                </summary>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 4 }}>
                  {list.map((m) => (
                    <li key={m.id} style={{ borderLeft: "3px solid var(--stone)", paddingLeft: 10 }}>
                      <div style={{ font: "700 20px/1.1 var(--font-hand)" }}>{fill(m.title)}</div>
                      <div style={{ fontSize: 17, lineHeight: 1.2, color: "var(--ink-soft)" }}>
                        {m.body} · {secs(m.seconds)}
                        {m.nodFriendly && " · nod-friendly"}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          );
        })}
        <p style={{ fontSize: 17, lineHeight: 1.2, color: "var(--ink-soft)", borderTop: "2px dashed var(--stone)", paddingTop: 12, textWrap: "pretty" }}>
          The picker fits the time left, the pair type and the delay, and won't repeat your last 10 missions.
        </p>
      </Card>
    </Screen>
  );
}
