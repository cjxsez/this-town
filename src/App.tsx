import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router";
import { stationById } from "../shared/catalog";
import { AppProvider, useApp } from "./state/store";
import { HandDrawnFx } from "./fx/HandDrawnFx";
import { DemoPanel } from "./dev/DemoPanel";
import { ScreenIndex, ScreenPreview } from "./dev/ScreenGallery";

import Landing from "./screens/onboarding/Landing";
import Name from "./screens/onboarding/Name";
import Interests from "./screens/onboarding/Interests";
import Spots from "./screens/onboarding/Spots";
import Battery from "./screens/onboarding/Battery";
import Handles from "./screens/onboarding/Handles";
import BadgeScan from "./screens/onboarding/BadgeScan";
import Poster from "./screens/print/Poster";
import BadgePrint from "./screens/print/BadgePrint";
import RideRoute from "./screens/ride/RideRoute";
import MissionTypes from "./screens/ride/MissionTypes";
import Passport from "./screens/collection/Passport";
import StampDetail from "./screens/collection/StampDetail";
import People from "./screens/collection/People";
import Person from "./screens/collection/Person";
import Memories from "./screens/collection/Memories";
import Me from "./screens/me/Me";
import Report from "./screens/me/Report";
import Glasses from "./screens/me/Glasses";
import GlassesLive from "./screens/me/GlassesLive";
import LensGallery from "./screens/me/LensGallery";

/** Signed-in screens bounce to the landing page until a profile exists. */
function RequireProfile({ children }: { children: ReactNode }) {
  const { state } = useApp();
  return state.profile ? <>{children}</> : <Navigate to="/" replace />;
}

/** "/" is the landing page for new riders and Ride Mode for returning ones. */
function Home() {
  const { state } = useApp();
  return state.profile ? <Navigate to="/ride" replace /> : <Landing />;
}

/**
 * The QR poster prints questline.page/<station>. Remember the station so B4
 * shows that station's spots and C1 preselects it.
 */
function StationEntry() {
  const { stationId = "" } = useParams();
  const { state, actions } = useApp();
  const station = stationById(stationId.toLowerCase());
  useEffect(() => {
    if (station) actions.updateDraft({ homeStation: station.id });
  }, [station, actions]);
  if (!station) return <Navigate to="/" replace />;
  return state.profile ? <Navigate to="/ride" replace /> : <Landing />;
}

const guard = (el: ReactNode) => <RequireProfile>{el}</RequireProfile>;

function Shell() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/name" element={<Name />} />
        <Route path="/join/interests" element={<Interests />} />
        <Route path="/join/spots" element={<Spots />} />
        <Route path="/join/battery" element={<Battery />} />
        <Route path="/join/handles" element={<Handles />} />
        <Route path="/join/badge" element={<BadgeScan />} />

        <Route path="/ride" element={<RideRoute />} />
        <Route path="/missions" element={<MissionTypes />} />
        <Route path="/passport" element={guard(<Passport />)} />
        <Route path="/passport/:stampId" element={guard(<StampDetail />)} />
        <Route path="/people" element={guard(<People />)} />
        <Route path="/people/:personId" element={guard(<Person />)} />
        <Route path="/people/:personId/report" element={guard(<Report />)} />
        <Route path="/memories" element={guard(<Memories />)} />
        <Route path="/me" element={guard(<Me />)} />
        <Route path="/me/glasses" element={guard(<Glasses />)} />
        <Route path="/me/glasses/live" element={guard(<GlassesLive />)} />
        <Route path="/lens" element={<LensGallery />} />

        <Route path="/screens" element={<ScreenIndex />} />
        <Route path="/screens/:id" element={<ScreenPreview />} />
        <Route path="/:stationId" element={<StationEntry />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DemoPanel />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <HandDrawnFx />
        <Routes>
          {/* Print pages render at full page size, outside the phone shell. */}
          <Route path="/print/poster/:stationId" element={<Poster />} />
          <Route path="/print/badge/:number" element={<BadgePrint />} />
          <Route path="*" element={<Shell />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
