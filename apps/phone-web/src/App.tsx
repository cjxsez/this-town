import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router";
import { stationById } from "../shared/catalog";
import { AppProvider, useApp } from "./state/store";
import { HandDrawnFx } from "./fx/HandDrawnFx";
import { DemoPanel } from "./dev/DemoPanel";
import { ScreenIndex, ScreenPreview } from "./dev/ScreenGallery";

import Landing from "./screens/onboarding/Landing";
import Start from "./screens/onboarding/Start";
import Name from "./screens/onboarding/Name";
import Interests from "./screens/onboarding/Interests";
import Spots from "./screens/onboarding/Spots";
import Battery from "./screens/onboarding/Battery";
import Handles from "./screens/onboarding/Handles";
import BadgeScan from "./screens/onboarding/BadgeScan";
import Poster from "./screens/print/Poster";
import BadgePrint from "./screens/print/BadgePrint";
import RideRoute from "./screens/ride/RideRoute";
import Tap, { takePendingTap } from "./screens/ride/Tap";
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

const STARTED_KEY = "its.started";
const hasStarted = () => {
  try {
    return sessionStorage.getItem(STARTED_KEY) === "1";
  } catch {
    return false;
  }
};
const markStarted = () => {
  try {
    sessionStorage.setItem(STARTED_KEY, "1");
  } catch {
    // Private mode without storage: the start screen just shows again next time.
  }
};

/** The 3D start screen, once per visit (tab session), then `children`. */
function StartGate({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(hasStarted);
  if (started) return <>{children}</>;
  return (
    <Start
      onBegin={() => {
        markStarted();
        setStarted(true);
      }}
    />
  );
}

/** "/start" always shows the start screen (handy for demos), then goes home. */
function StartAgain() {
  const navigate = useNavigate();
  return (
    <Start
      onBegin={() => {
        markStarted();
        navigate("/", { replace: true });
      }}
    />
  );
}

/** "/" is the start screen, then the landing page for new riders and Ride Mode for returning ones. */
function Home() {
  const { state } = useApp();
  return <StartGate>{state.profile ? <Navigate to="/ride" replace /> : <Landing />}</StartGate>;
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
  return <StartGate>{state.profile ? <Navigate to="/ride" replace /> : <Landing />}</StartGate>;
}

const guard = (el: ReactNode) => <RequireProfile>{el}</RequireProfile>;

/** A rider who tapped a kiosk tag before joining goes back to that tap once they have a profile. */
function usePendingTap() {
  const { state } = useApp();
  const navigate = useNavigate();
  const joined = !!state.profile;
  useEffect(() => {
    const path = joined ? takePendingTap() : null;
    if (path) navigate(path, { replace: true });
  }, [joined, navigate]);
}

function Shell() {
  usePendingTap();
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<StartAgain />} />
        <Route path="/join/name" element={<Name />} />
        <Route path="/join/interests" element={<Interests />} />
        <Route path="/join/spots" element={<Spots />} />
        <Route path="/join/battery" element={<Battery />} />
        <Route path="/join/handles" element={<Handles />} />
        <Route path="/join/badge" element={<BadgeScan />} />

        <Route path="/ride" element={<RideRoute />} />
        <Route path="/k/:car" element={<Tap />} />
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
