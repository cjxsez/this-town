/**
 * App.tsx (kiosk-web): the kiosk screen state machine.
 *
 * No router: the car comes from /kiosk/:car (lib/config.ts). Screens switch on
 * ServerToKiosk events from /ws/kiosk/:car?key=&role=screen (lib/socket.ts):
 *
 *   bad URL (no car or key)         -> Disconnected (config error)
 *   socket "offline"                -> Disconnected (reconnecting), over any screen
 *   socket "rejected" (badAuth/forbidden) -> Disconnected (bad key / unknown car), no retry
 *   kiosk.idle                      -> updates stats; Idle if no pair is active here
 *   pair.incoming                   -> PairIncoming (remember names + color by matchId)
 *   mission.show                    -> Mission (names from the stored pair)
 *   celebrate                       -> Celebrate, back to Idle after CELEBRATE_MS
 *   pair.cleared (active matchId)   -> Idle
 *   stamp.progress                  -> fills the "both tap the tag" dots on Mission
 *   nfc.write                       -> ignored (Pi only, dropped in lib/socket.ts)
 *
 * Pure reducer: src/state.ts. Clock offset via setServerNow before dispatch.
 *
 * Privacy: this screen is public. Only first names and colors ever reach state here.
 */
import { useEffect, useReducer, useState, type ReactNode } from "react";
import { PAIR_COLOR_HEX, RARE_ACCENT_HEX } from "@questline/protocol";
import { Stage } from "./components/Stage";
import { HandDrawnFilters } from "./components/Ui";
import { setServerNow } from "./lib/clock";
import { parseCar, readConfig, type ConfigResult } from "./lib/config";
import { PREVIEW_SCREENS, readPreview, SAMPLE, type PreviewMode, type PreviewScreen } from "./lib/preview";
import { connectKioskSocket } from "./lib/socket";
import { loadWorkerMode } from "./lib/workerMode";
import { Celebrate } from "./screens/Celebrate";
import { Disconnected } from "./screens/Disconnected";
import { Idle } from "./screens/Idle";
import { Mission } from "./screens/Mission";
import { PairIncoming } from "./screens/PairIncoming";
import { initialKioskState, reduceKiosk } from "./state";

const CELEBRATE_MS = 6000;

export function App() {
  const [preview] = useState<PreviewMode | null>(() => readPreview());
  const [config] = useState<ConfigResult>(() => readConfig());
  if (preview) return <Preview mode={preview} car={parseCar(window.location.pathname) ?? "1412"} />;
  if (!config.ok) return <Shell bg={NIGHT}><Disconnected car={config.car} error={config.error} /></Shell>;
  return <KioskScreen car={config.config.car} kioskKey={config.config.key} />;
}

const SEA = "#62c1bc";
const NIGHT = "#2b4656";

function Shell({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <>
      <HandDrawnFilters />
      <Stage bg={bg}>{children}</Stage>
    </>
  );
}

function KioskScreen({ car, kioskKey }: { car: string; kioskKey: string }) {
  const [state, dispatch] = useReducer(reduceKiosk, initialKioskState);
  const [gamesOnly, setGamesOnly] = useState(false);

  useEffect(() => {
    void loadWorkerMode().then((m) => setGamesOnly(m.gamesOnly));
  }, []);

  useEffect(() => {
    const socket = connectKioskSocket({
      config: { car, key: kioskKey },
      onEvent: (event) => {
        const at = Date.now();
        if ("serverNow" in event && typeof event.serverNow === "number") setServerNow(event.serverNow, at);
        dispatch({ type: "event", event, at });
      },
      onStatus: (status) => dispatch({ type: "status", status }),
    });
    return () => socket.close();
  }, [car, kioskKey]);

  const { screen } = state;

  useEffect(() => {
    if (screen.name !== "celebrate") return;
    const matchId = screen.matchId;
    const id = window.setTimeout(() => dispatch({ type: "celebrateDone", matchId }), CELEBRATE_MS);
    return () => window.clearTimeout(id);
  }, [screen]);

  if (state.status === "rejected") {
    return (
      <Shell bg={NIGHT}>
        <Disconnected car={car} error="Bad kiosk key or unknown car. Fix the URL and reload." />
      </Shell>
    );
  }
  // Connecting and offline share the night screen so riders never see Tap to play before the socket is up.
  if (state.status === "connecting") {
    return <Shell bg={NIGHT}><Disconnected car={car} connecting /></Shell>;
  }
  if (state.status === "offline") return <Shell bg={NIGHT}><Disconnected car={car} /></Shell>;

  const idle = <Shell bg={SEA}><Idle car={car} stats={state.stats} nextStopAt={state.nextStopAt} /></Shell>;
  switch (screen.name) {
    case "idle":
      return idle;
    case "pair": {
      const pair = state.pairs[screen.matchId];
      if (!pair) return idle;
      return (
        <Shell bg={PAIR_COLOR_HEX[pair.color]}>
          <PairIncoming color={pair.color} firstNames={pair.firstNames} arrived={pair.arrived} gamesOnly={gamesOnly} />
        </Shell>
      );
    }
    case "mission":
      return (
        <Shell bg={SEA}>
          <Mission
            color={screen.color}
            mission={screen.mission}
            firstNames={state.pairs[screen.matchId]?.firstNames ?? null}
            startedAt={screen.startedAt}
            tapped={screen.tapped}
          />
        </Shell>
      );
    case "celebrate":
      return (
        <Shell bg={screen.rare ? RARE_ACCENT_HEX : PAIR_COLOR_HEX[screen.color]}>
          <Celebrate color={screen.color} rare={screen.rare} firstNames={state.pairs[screen.matchId]?.firstNames ?? null} />
        </Shell>
      );
  }
}

/** Sample screens for design checks (lib/preview.ts). */
function Preview({ mode, car }: { mode: PreviewMode; car: string }) {
  const [i, setI] = useState(0);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    if (mode !== "all") return;
    const id = window.setInterval(() => setI((n) => (n + 1) % PREVIEW_SCREENS.length), 6000);
    return () => window.clearInterval(id);
  }, [mode]);

  const which: PreviewScreen = mode === "all" ? PREVIEW_SCREENS[i]! : mode;
  const { color, firstNames, stats } = SAMPLE;
  switch (which) {
    case "idle":
      return <Shell bg={SEA}><Idle car={car} stats={stats} nextStopAt={now + stats.nextStopEtaSec * 1000} /></Shell>;
    case "pair":
      return <Shell bg={PAIR_COLOR_HEX[color]}><PairIncoming color={color} firstNames={firstNames} arrived={1} /></Shell>;
    case "mission":
      return <Shell bg={SEA}><Mission color={color} mission={SAMPLE.mission(now)} firstNames={firstNames} startedAt={now} tapped={1} /></Shell>;
    case "celebrate":
      return <Shell bg={PAIR_COLOR_HEX[color]}><Celebrate color={color} rare={false} firstNames={firstNames} /></Shell>;
    case "rare":
      return <Shell bg={RARE_ACCENT_HEX}><Celebrate color={color} rare firstNames={firstNames} /></Shell>;
    case "offline":
      return <Shell bg={NIGHT}><Disconnected car={car} /></Shell>;
  }
}
