import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { useApp } from "../state/store";
import { rideFixture } from "./fixtures";
import RideRoute from "../screens/ride/RideRoute";
import MissionTypes from "../screens/ride/MissionTypes";

/** Every wireframe screen id → where it lives. Ride ids render from a fixture. */
export const SCREENS: { id: string; label: string; to?: string }[] = [
  { id: "A1", label: "QR poster (print)", to: "/print/poster/kenmore" },
  { id: "A2", label: "Badge (print)", to: "/print/badge/17" },
  { id: "B1", label: "Landing from QR", to: "/kenmore" },
  { id: "B2", label: "Name + 18+", to: "/join/name" },
  { id: "B3", label: "Interests", to: "/join/interests" },
  { id: "B4", label: "Spots + ask me about", to: "/join/spots" },
  { id: "B5", label: "Social battery + AI", to: "/join/battery" },
  { id: "B6", label: "Handles", to: "/join/handles" },
  { id: "B7", label: "Get your badge", to: "/join/badge" },
  { id: "C1", label: "Ride Mode off / check in" },
  { id: "C2", label: "Waiting, quests on" },
  { id: "C3", label: "No signal" },
  { id: "C4", label: "Train came, no match" },
  { id: "D1", label: "Offer" },
  { id: "D2", label: "You said yes, waiting" },
  { id: "D3", label: "Didn't happen" },
  { id: "D4", label: "Offer, delay boosted" },
  { id: "E1", label: "Meet card" },
  { id: "E2", label: "Can't spot them" },
  { id: "E3", label: "Greeting" },
  { id: "F1", label: "Mission active" },
  { id: "F2", label: "Mission types", to: "/missions" },
  { id: "F3", label: "Train in 30 s" },
  { id: "G1", label: "Bump" },
  { id: "G2", label: "Stamp + photo ask" },
  { id: "G3", label: "Photo: both agreed" },
  { id: "G4", label: "Keep or delete" },
  { id: "H1", label: "Quest recap" },
  { id: "H2", label: "Passport", to: "/passport" },
  { id: "H3", label: "Stamp detail", to: "/passport/s-bu-east" },
  { id: "H4", label: "People", to: "/people" },
  { id: "H5", label: "Person", to: "/people/p-dev" },
  { id: "H6", label: "Memories", to: "/memories" },
  { id: "I1", label: "Me / Safety", to: "/me" },
  { id: "I2", label: "Report / block", to: "/people/p-dev/report" },
  { id: "J1", label: "Connect glasses", to: "/me/glasses" },
  { id: "J2", label: "Session live", to: "/me/glasses/live" },
  { id: "L", label: "All seven lens cards", to: "/lens" },
];

export function ScreenIndex() {
  return (
    <div style={{ position: "absolute", inset: 0, overflowY: "auto", background: "var(--page)", padding: "24px 16px" }}>
      <h1 className="q-display" style={{ fontSize: 22, marginBottom: 12 }}>Every screen</h1>
      <div style={{ display: "grid", gap: 6 }}>
        {SCREENS.map((s) => (
          <Link key={s.id} to={`/screens/${s.id}`} className="q-card q-card--tight q-card--flat" style={{ flexDirection: "row", alignItems: "center", textDecoration: "none" }}>
            <span className="q-pill q-pill--dark">{s.id}</span>
            <span style={{ fontWeight: 700 }}>{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ScreenPreview() {
  const { id = "" } = useParams();
  const { state, actions } = useApp();
  const [ready, setReady] = useState(false);
  const entry = SCREENS.find((s) => s.id === id.toUpperCase());

  // Onboarding and print screens preview as a new rider; everything else needs a profile.
  const needsProfile = !!entry && !/^[AB]/.test(entry.id);

  useEffect(() => {
    // Previews go straight to the screen, past the once-per-visit start screen.
    try {
      sessionStorage.setItem("its.started", "1");
    } catch {
      // no storage: the start screen shows first, which is fine
    }
    if (needsProfile && !state.profile) actions.useDemoProfile();
    if (entry && !entry.to) actions.devSetRide(rideFixture(entry.id));
    setReady(true);
    // Run once per screen id; fixtures shouldn't be re-applied on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!entry) return <Navigate to="/screens" replace />;
  // Wait for the demo profile to land before navigating, or guarded routes bounce to "/".
  if (!ready || (needsProfile && !state.profile)) return null;
  if (entry.to) return <Navigate to={entry.to} replace />;
  return entry.id === "F2" ? <MissionTypes /> : <RideRoute />;
}
