import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { AppProvider, useApp } from "./state/store";
import { setDoorsOpening } from "./state/doors";
import { HandDrawnFx } from "./fx/HandDrawnFx";
import { DemoPanel } from "./dev/DemoPanel";
import { ScreenIndex, ScreenPreview } from "./dev/ScreenGallery";

import Landing from "./screens/onboarding/Landing";
import Start from "./screens/onboarding/Start";
import Name from "./screens/onboarding/Name";
import Interests from "./screens/onboarding/Interests";
import AskMeAbout from "./screens/onboarding/AskMeAbout";
import Battery from "./screens/onboarding/Battery";
import RideModeRules from "./screens/onboarding/RideModeRules";
import SignInEmail from "./screens/signin/SignInEmail";
import SignInCode from "./screens/signin/SignInCode";
import Poster from "./screens/print/Poster";
import RideRoute from "./screens/ride/RideRoute";
import Tap, { takePendingTap } from "./screens/ride/Tap";
import MissionTypes from "./screens/ride/MissionTypes";
import Passport from "./screens/collection/Passport";
import StampDetail from "./screens/collection/StampDetail";
import MapScreen from "./screens/collection/MapScreen";
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

/** "/" is the landing page for new riders and Ride Mode for returning ones (after the start screen, see Shell). */
function Home() {
  const { state } = useApp();
  return state.profile ? <Navigate to="/ride" replace /> : <Landing />;
}

type Gate = "start" | "reveal" | "done";

/**
 * The 3D start screen sits above the routes: once per visit (tab session) at "/",
 * and every time at "/start". Nothing mounts behind it until BEGIN; then the page
 * mounts behind the shut doors and they open onto it. Living here, not inside a
 * route, it survives the redirect a returning rider gets to /ride.
 */
function useStartGate() {
  const location = useLocation();
  const [gate, setGate] = useState<Gate>(() =>
    location.pathname === "/start" || (location.pathname === "/" && !hasStarted()) ? "start" : "done",
  );
  return {
    gate,
    begin() {
      markStarted();
      setDoorsOpening(true);
      setGate("reveal");
    },
    revealed() {
      setDoorsOpening(false);
      setGate("done");
    },
  };
}

const guard = (el: ReactNode) => <RequireProfile>{el}</RequireProfile>;

/** A rider who tapped a kiosk tag before joining goes back to that tap once they have a profile. */
function usePendingTap() {
  const { state } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const joined = !!state.profile;
  // Onboarding (B7) and sign-in (S2) hand the tap back themselves when they finish; replaying
  // it here too would race their own navigate("/ride").
  const busy = pathname.startsWith("/join/") || pathname.startsWith("/signin");
  useEffect(() => {
    const path = joined && !busy ? takePendingTap() : null;
    if (path) navigate(path, { replace: true });
  }, [joined, busy, navigate]);
}

function Shell() {
  usePendingTap();
  const start = useStartGate();
  return (
    <div className="app-shell">
      {start.gate !== "start" && <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignInEmail />} />
        <Route path="/signin/code" element={<SignInCode />} />
        <Route path="/start" element={<Navigate to="/" replace />} />
        <Route path="/join/name" element={<Name />} />
        <Route path="/join/interests" element={<Interests />} />
        <Route path="/join/about" element={<AskMeAbout />} />
        <Route path="/join/battery" element={<Battery />} />
        <Route path="/join/ride-mode" element={<RideModeRules />} />

        <Route path="/ride" element={<RideRoute />} />
        <Route path="/k/:car" element={<Tap />} />
        <Route path="/missions" element={<MissionTypes />} />
        <Route path="/passport" element={guard(<Passport />)} />
        <Route path="/passport/map" element={guard(<MapScreen />)} />
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
      </Routes>}
      {start.gate !== "done" && <Start revealing={start.gate === "reveal"} onBegin={start.begin} onRevealed={start.revealed} />}
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
