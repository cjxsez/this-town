import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { LineColor } from "../../../../shared/types";
import { useApp } from "../../../state/store";

interface SceneHandle {
  ready: Promise<boolean>;
  setArriveAt(epochMs: number | undefined): void;
  setFrame(frame: { top: number; height: number } | null): void;
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
 *
 * As a full-screen backdrop (`<Screen backdrop>`), pass `frameRef`: the element in
 * the page that leaves room for the scene. The train is composed inside that element's
 * box, the picture extends above and below it, and below it fades into the sea so
 * text and cards there stay easy to read.
 */
export function PlatformScene3D({
  line = "green",
  mode = "loop",
  arriveAt,
  fallback,
  children,
  style,
  frameRef,
  onStatus,
}: {
  line?: LineColor;
  mode?: "loop" | "arrive";
  arriveAt?: number;
  fallback?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  /** Compose the train inside this element's box (backdrop use). */
  frameRef?: RefObject<HTMLElement | null>;
  /** Tells the page whether the scene is drawing, e.g. to show its own flat fallback. */
  onStatus?: (status: "loading" | "ready" | "failed") => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle | null>(null);
  const due = useRef(arriveAt);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const { state } = useApp();
  const { timeOfDay, motion } = state.settings;

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
  }, [line, mode, timeOfDay, motion]);

  useEffect(() => onStatus?.(status), [status, onStatus]);

  // Backdrop: keep the scene composed for the frame element's box. offsetTop is layout,
  // so an entrance animation's transform on the frame never skews it.
  useEffect(() => {
    const el = frameRef?.current;
    const box = root.current;
    if (!el || !box || status !== "ready") return;
    const scroller = el.closest(".q-screen__body");
    const update = () => {
      const top = el.offsetTop - (scroller?.scrollTop ?? 0);
      scene.current?.setFrame({ top, height: el.offsetHeight });
      box.style.setProperty("--frame-bottom", `${top + el.offsetHeight}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    observer.observe(box);
    scroller?.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      scroller?.removeEventListener("scroll", update);
    };
  }, [frameRef, status]);

  // The train's time changes as predictions update; tell the scene without rebuilding it.
  useEffect(() => {
    due.current = arriveAt;
    scene.current?.setArriveAt(arriveAt);
  }, [arriveAt]);

  return (
    <div ref={root} className={`q-scene3d${frameRef ? " q-scene3d--backdrop" : ""}`} data-status={status} style={style}>
      <div ref={host} className="q-scene3d__view" aria-hidden />
      {frameRef && <div className="q-scene3d__fade" aria-hidden />}
      {status === "failed" ? fallback && <div className="q-scene3d__flat">{fallback}</div> : children && <div className="q-scene3d__over">{children}</div>}
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
