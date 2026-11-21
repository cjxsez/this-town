/**
 * App.tsx: router for phone-web (react-router-dom v7, browser history, base "/").
 *
 * Route map:
 *   /onboarding[?next=]   OnboardingFlow (no auth)       POST /api/users
 *   /k/:car?n=<nonce>     Tap, the NFC landing page      POST /api/taps
 *   /                     Home, Ride Mode status          socket + /api/ride/*
 *   /link                 LinkGlasses                     POST /api/glasses/link
 *   /passport             Passport                        GET /api/passport
 *   /report/:matchId      Report                          POST /api/report
 *   *                     redirect to /
 *
 * Responsible for: the tab layout (Ride / Passport) around signed-in screens, and the
 * RequireRider guard that sends riders without a token to onboarding with ?next= so they
 * come back. /k/:car is outside the layout and does its own onboarding redirect (it must
 * keep the nonce in the return URL).
 *
 * The worker must serve /index.html for every one of these paths (SPA fallback for "/").
 *
 * TODO:
 * - Error boundary route (errorElement) with a friendly "reload" screen.
 * - Hide the tab bar while onboarding/tap screens are full-bleed (already outside layout).
 */
import type { ReactNode } from "react";
import {
  createBrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { hasToken, onboardingPath } from "./lib/auth";
import { Home } from "./routes/Home";
import { LinkGlasses } from "./routes/LinkGlasses";
import { OnboardingFlow } from "./routes/onboarding/OnboardingFlow";
import { Passport } from "./routes/Passport";
import { Report } from "./routes/Report";
import { Tap } from "./routes/Tap";

function RequireRider({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!hasToken()) {
    return <Navigate to={onboardingPath(location.pathname + location.search)} replace />;
  }
  return <>{children}</>;
}

function Layout() {
  return (
    <RequireRider>
      <div className="app">
        <main className="screen">
          <Outlet />
        </main>
        <nav className="tabbar">
          <NavLink to="/" end>
            Ride
          </NavLink>
          <NavLink to="/passport">Passport</NavLink>
        </nav>
      </div>
    </RequireRider>
  );
}

const router = createBrowserRouter([
  { path: "/onboarding", element: <OnboardingFlow /> },
  { path: "/k/:car", element: <Tap /> },
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "link", element: <LinkGlasses /> },
      { path: "passport", element: <Passport /> },
      { path: "report/:matchId", element: <Report /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
