/**
 * App.tsx (glasses-web): the HUD screen state machine.
 *
 * No router: the whole app lives at /g/ and switches screens on socket events.
 * Pure reducer: src/state.ts. Clock offset via setServerNow before dispatch.
 *
 * Socket: /ws/rider?token= (lib/socket.ts), sends rider.hello {client:"glasses"} on open.
 * Reload mid-match restores from ride.snapshot.match / mission (protocol RideSnapshot).
 *
 * A match with a game (match.game, GAMES_ONLY) shows the match card until the partner opens
 * the game, then the game itself: <Games follow> moves the rider's seat onto this lens.
 */
import { useCallback, useEffect, useReducer, useRef } from "react";
import { setServerNow } from "./lib/clock";
import { clearToken, loadToken } from "./lib/link";
import { connectRiderSocket, type RiderSocket } from "./lib/socket";
import { Games } from "./Games";
import { useWakeLock } from "./lib/wakeLock";
import { Idle } from "./screens/Idle";
import { LinkCode } from "./screens/LinkCode";
import { MatchCard } from "./screens/MatchCard";
import { Mission } from "./screens/Mission";
import { Offline } from "./screens/Offline";
import { Stamp } from "./screens/Stamp";
import { initGlassesState, reduceGlasses } from "./state";

export function App() {
  const [state, dispatch] = useReducer(reduceGlasses, undefined, () => initGlassesState(loadToken()));
  const socketRef = useRef<RiderSocket | null>(null);
  useWakeLock(Boolean(state.token));

  useEffect(() => {
    if (!state.token) return;
    const socket = connectRiderSocket({
      token: state.token,
      onEvent: (event) => {
        const at = Date.now();
        if (event.type === "ride.snapshot") setServerNow(event.snapshot.serverNow, at);
        else if ("serverNow" in event && typeof event.serverNow === "number") setServerNow(event.serverNow, at);
        dispatch({ type: "event", event, at });
      },
      onStatus: (status) => dispatch({ type: "status", status }),
      onAuthFailed: () => {
        clearToken();
        dispatch({ type: "unlinked" });
      },
    });
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [state.token]);

  // mission.end "stamped" with no stamp.awarded within 5 s -> Idle.
  useEffect(() => {
    if (state.stampedAt === null) return;
    const id = window.setTimeout(() => dispatch({ type: "stampTimeout" }), 5_000);
    return () => window.clearTimeout(id);
  }, [state.stampedAt]);

  useEffect(() => {
    if (!state.sendError) return;
    const id = window.setTimeout(() => dispatch({ type: "sendError", message: null }), 3_000);
    return () => window.clearTimeout(id);
  }, [state.sendError]);

  const onLinked = useCallback((token: string) => dispatch({ type: "linked", token }), []);
  const onArrived = useCallback(() => {
    void (async () => {
      const ok = await socketRef.current?.send({ type: "rider.arrived" });
      if (ok === false) dispatch({ type: "sendError", message: "Couldn't send" });
      else dispatch({ type: "arrived" });
    })();
  }, []);
  const onNotNow = useCallback(() => {
    void (async () => {
      const ok = await socketRef.current?.send({ type: "rider.notNow" });
      if (ok === false) dispatch({ type: "sendError", message: "Couldn't send" });
      else dispatch({ type: "notNow" });
    })();
  }, []);
  const onStampDone = useCallback(() => dispatch({ type: "stampDismissed" }), []);
  const onRetry = useCallback(() => socketRef.current?.retryNow(), []);

  if (!state.token) return <LinkCode onLinked={onLinked} />;
  if (state.status === "offline") return <Offline onRetry={onRetry} />;

  const { screen } = state;
  const banner = state.sendError ? (
    <div className="hud-send-error" role="status" aria-live="assertive">
      {state.sendError}
    </div>
  ) : null;
  switch (screen.name) {
    case "idle":
      return (
        <>
          <Idle ride={state.ride} nextStopAt={state.nextStopAt} status={state.status} />
          {banner}
        </>
      );
    case "match": {
      const card = (
        <MatchCard
          match={screen.match}
          currentCar={state.ride?.car}
          arrived={screen.arrived}
          onArrived={onArrived}
          onNotNow={onNotNow}
        />
      );
      const game = screen.match.game;
      return (
        <>
          {game ? <Games key={`${game.code}:${game.seat}`} follow={game} waiting={card} /> : card}
          {banner}
        </>
      );
    }
    case "mission":
      return (
        <>
          <Mission mission={screen.mission} partner={screen.partner} tapped={screen.tapped} />
          {banner}
        </>
      );
    case "stamp":
      return (
        <>
          <Stamp stamp={screen.stamp} onDone={onStampDone} />
          {banner}
        </>
      );
  }
}
