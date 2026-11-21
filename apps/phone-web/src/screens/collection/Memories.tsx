import { Body, Card, Screen } from "../../ui";
import { useApp } from "../../state/store";
import { hoursLeft } from "../../state/format";
import { useNow } from "../../state/useNow";
import { stationById } from "../../../shared/catalog";
import type { Memory } from "../../../shared/types";
import { MemoryPhoto } from "./parts";

const TILTS = [-0.4, 0.8, -0.5, 0.6];

export default function Memories() {
  const { state, actions } = useApp();
  const now = useNow();
  const nameOf = (m: Memory) => state.people.find((p) => p.id === m.personId)?.firstName ?? "them";
  const caption = (m: Memory) => `${nameOf(m)} · ${stationById(m.stationId)?.name ?? "the T"}`;
  // A blocked person's photos go with them.
  const visible = state.memories.filter((m) => !state.people.find((p) => p.id === m.personId)?.blocked);
  const deciding = visible.filter((m) => m.status === "deciding");
  const kept = visible.filter((m) => m.status === "kept").sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  return (
    <Screen tabs label="H6">
      <h1 className="cl-h1">MEMORIES</h1>

      {deciding.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 className="cl-eyebrow">DECIDING · AUTO-DELETES</h2>
          <div className="cl-grid">
            {deciding.map((m, i) => {
              const name = nameOf(m);
              return (
                <Card key={m.id} className="cl-tile" style={{ rotate: `${TILTS[i % TILTS.length]}deg` }}>
                  <MemoryPhoto memory={m} name={name} style={{ height: 108 }} />
                  <div className="cl-tile__cap">{caption(m)}</div>
                  {m.youKept ? (
                    <p className="cl-tile__note">
                      You kept · waiting on {name} · {hoursLeft(m.expiresAt, now)}
                    </p>
                  ) : (
                    <div className="cl-vote">
                      <button
                        type="button"
                        aria-label={`Delete the photo with ${name}`}
                        onClick={() => void actions.voteMemory(m.id, false)}
                        style={{ background: "var(--paper)", color: "var(--rust)", borderRadius: "var(--r4)" }}
                      >
                        ✕
                      </button>
                      <button
                        type="button"
                        aria-label={`Keep the photo with ${name}`}
                        onClick={() => void actions.voteMemory(m.id, true)}
                        style={{ background: "var(--yellow)", color: "var(--ink)", borderRadius: "var(--r1)" }}
                      >
                        KEEP
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="cl-eyebrow">KEPT BY BOTH</h2>
        {kept.length === 0 ? (
          <Card>
            <Body>Photos you both keep land here. If either of you says no, it's gone for good.</Body>
          </Card>
        ) : (
          <div className="cl-grid">
            {kept.map((m, i) => (
              <Card key={m.id} className="cl-tile" style={{ rotate: `${TILTS[(i + 2) % TILTS.length]}deg` }}>
                <MemoryPhoto memory={m} name={nameOf(m)} style={{ height: 108 }} />
                <div className="cl-tile__cap">
                  {caption(m)}
                  {m.rare && <span aria-label=", rare"> ★</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </Screen>
  );
}
