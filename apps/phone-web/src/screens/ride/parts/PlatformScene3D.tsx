import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BADGE_COLORS } from "../../../../shared/catalog";
import type { LineColor } from "../../../../shared/types";
import { useApp } from "../../../state/store";

interface SceneHandle {
  ready: Promise<boolean>;
  setArriveAt(epochMs: number | undefined): void;
  dispose(): void;
}

/**
 * The live platform view: you stand on the platform and watch the trolley come
 * round the bend and pull in. It is the start screen's island seen from one of
 * its stops, drawn by the same renderer (packages/start-screen, platform.ts).
 *
 * - `mode="loop"`: trolleys keep coming (waiting screens).
 * - `mode="arrive"`: one trolley, due at `arriveAt` (epoch ms); it rolls in for the
 *   last seconds and stays. Without `arriveAt` it comes in straight away.
 *
 * `children` are laid over the picture (signs, captions). three.js is loaded on
 * demand; while it loads the box is plain sea, and the scene pops in when ready.
 * Without WebGL, or if the download fails, `fallback` (the flat scene) shows instead.
 */
export function PlatformScene3D({
  line = "green",
  mode = "loop",
  arriveAt,
  fallback,
  children,
  style,
}: {
  line?: LineColor;
  mode?: "loop" | "arrive";
  arriveAt?: number;
  fallback: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle | null>(null);
  const due = useRef(arriveAt);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const { state } = useApp();
  const { timeOfDay, motion } = state.settings;
  const badge = state.profile?.badge;
  const riderColor = badge ? BADGE_COLORS[badge.color] : undefined;

  useEffect(() => {
    let gone = false;
    setStatus("loading");
    import("@questline/start-screen")
      .then(({ mountPlatformScene }) => {
        if (gone || !host.current) return;
        const mounted = mountPlatformScene(host.current, {
          line,
          mode,
          arriveAt: due.current,
          riderColor,
          timeOfDay,
          // Me > Motion off parks the train; otherwise the system setting decides.
          reducedMotion: motion ? undefined : true,
        });
        scene.current = mounted;
        void mounted.ready.then((ok) => {
          if (!gone) setStatus(ok ? "ready" : "failed");
        });
      })
      .catch(() => {
        if (!gone) setStatus("failed");
      });
    return () => {
      gone = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [line, mode, riderColor, timeOfDay, motion]);

  // The train's time changes as predictions update; tell the scene without rebuilding it.
  useEffect(() => {
    due.current = arriveAt;
    scene.current?.setArriveAt(arriveAt);
  }, [arriveAt]);

  return (
    <div className="q-scene3d" data-status={status} style={style}>
      <div ref={host} className="q-scene3d__view" aria-hidden />
      {status === "failed" ? <div className="q-scene3d__flat">{fallback}</div> : <div className="q-scene3d__over">{children}</div>}
    </div>
  );
}

/** The station's name on a sign with the line's colour along the top, laid over the scene. */
export function PlatformSign({ name, color, style }: { name: string; color: string; style?: CSSProperties }) {
  return (
    <div className="q-scene3d__sign" style={{ borderTopColor: color, ...style }}>
      {name}
    </div>
  );
}
