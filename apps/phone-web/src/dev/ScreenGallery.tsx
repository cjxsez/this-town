import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { useApp } from "../state/store";
import { rideFixture } from "./fixtures";
import RideRoute from "../screens/ride/RideRoute";
import MissionTypes from "../screens/ride/MissionTypes";

/** Every wireframe screen id → where it lives. Ride ids render from a fixture. */
export const SCREENS: { id: string; label: string; to?: string }[] = [
  { id: "A1", label: "Kiosk tap sign (print)", to: "/print/tag/1412" },
  { id: "B1", label: "Landing", to: "/" },
  { id: "B2", label: "Name + 18+", to: "/join/name" },
  { id: "B3", label: "Interests", to: "/join/interests" },
  { id: "B4", label: "Ask me about", to: "/join/about" },
  { id: "B5", label: "Social battery", to: "/join/battery" },
  { id: "B6", label: "How Ride Mode works", to: "/join/ride-mode" },
  { id: "B7", label: "Link glasses", to: "/join/glasses" },
  { id: "K1", label: "Kiosk tap: pick stop, confirm Ride Mode", to: "/k/1412" },
  { id: "C1", label: "Ride Mode off: tap the kiosk" },
  { id: "C2", label: "Ride Mode on, looking" },
  { id: "C3", label: "No signal" },
  { id: "C4", label: "Ride Mode off: your stop" },
  { id: "C5", label: "Ride Mode off: you turned it off" },
  { id: "D3", label: "Match fell through" },
  { id: "D4", label: "You pressed Not now" },
  { id: "E1", label: "Matched: walk to their kiosk" },
  { id: "E2", label: "Matched: stay put" },
  { id: "E3", label: "At the kiosk, mission starting" },
  { id: "F1", label: "Mission" },
  { id: "F2", label: "Mission types", to: "/missions" },
  { id: "F3", label: "Mission, 1 of 2 tapped" },
  { id: "G2", label: "Stamp" },
  { id: "H1", label: "Quest recap" },
  { id: "H2", label: "Passport", to: "/passport" },
  { id: "H3", label: "Stamp detail", to: "/passport/s-bu-east" },
  { id: "H4", label: "People", to: "/people" },
  { id: "H5", label: "Person", to: "/people/p-dev" },
  { id: "I1", label: "Me / Safety", to: "/me" },
  { id: "I2", label: "Report / block", to: "/people/p-dev/report" },
  { id: "J1", label: "Glasses", to: "/me/glasses" },
  { id: "L", label: "Every lens card", to: "/lens" },
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
