import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router";
import { AppProvider, useApp } from "./state/store";
import { HandDrawnFx } from "./fx/HandDrawnFx";
import { DemoPanel } from "./dev/DemoPanel";
import { ScreenIndex, ScreenPreview } from "./dev/ScreenGallery";

import Landing from "./screens/onboarding/Landing";
import Name from "./screens/onboarding/Name";
import Interests from "./screens/onboarding/Interests";
import AskMeAbout from "./screens/onboarding/AskMeAbout";
import Battery from "./screens/onboarding/Battery";
import RideModeRules from "./screens/onboarding/RideModeRules";
import LinkGlasses from "./screens/onboarding/LinkGlasses";
import Poster from "./screens/print/Poster";
import RideRoute from "./screens/ride/RideRoute";
import Tap, { takePendingTap } from "./screens/ride/Tap";
import MissionTypes from "./screens/ride/MissionTypes";
import Passport from "./screens/collection/Passport";
import StampDetail from "./screens/collection/StampDetail";
import People from "./screens/collection/People";
import Person from "./screens/collection/Person";
import Me from "./screens/me/Me";
import Report from "./screens/me/Report";
import Glasses from "./screens/me/Glasses";
import LensGallery from "./screens/me/LensGallery";
import MRoute from "./m/MRoute";

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
        <Route path="/join/name" element={<Name />} />
        <Route path="/join/interests" element={<Interests />} />
        <Route path="/join/about" element={<AskMeAbout />} />
        <Route path="/join/battery" element={<Battery />} />
        <Route path="/join/ride-mode" element={<RideModeRules />} />
        <Route path="/join/glasses" element={<LinkGlasses />} />

        <Route path="/ride" element={<RideRoute />} />
        <Route path="/k/:car" element={<Tap />} />
        <Route path="/missions" element={<MissionTypes />} />
        <Route path="/passport" element={guard(<Passport />)} />
        <Route path="/passport/:stampId" element={guard(<StampDetail />)} />
        <Route path="/people" element={guard(<People />)} />
        <Route path="/people/:personId" element={guard(<Person />)} />
        <Route path="/people/:personId/report" element={guard(<Report />)} />
        <Route path="/me" element={guard(<Me />)} />
        <Route path="/me/glasses" element={guard(<Glasses />)} />
        <Route path="/lens" element={<LensGallery />} />

        <Route path="/screens" element={<ScreenIndex />} />
        <Route path="/screens/:id" element={<ScreenPreview />} />
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
          <Route path="/print/tag/:car" element={<Poster />} />
          {/* The two-player games, phone side. No profile needed and no ride controls. */}
          <Route
            path="/m"
            element={
              <div className="app-shell">
                <MRoute />
              </div>
            }
          />
          <Route path="*" element={<Shell />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
