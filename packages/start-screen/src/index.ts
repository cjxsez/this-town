/**
 * In This Town start screen.
 *
 *   import { mountStartScreen } from "@questline/start-screen";
 *   const screen = mountStartScreen(element, { onBegin: () => navigate("/join/name") });
 *   // later: screen.dispose();
 *
 * `element` needs a size (the screen fills it). Every number is in config.ts.
 */
import { CONFIG, type CueName, type TimeOfDay } from "./config";
import { createRuntime, type Runtime } from "./app";
import { createOverlay } from "./dom";
import { loadFonts } from "./scene/glyphs";

export { CONFIG, EASE, NAME, TITLE } from "./config";
export { mountPlatformScene, LINE_NAMES } from "./platform";
export type { LineName, PlatformSceneHandle, PlatformSceneOptions } from "./platform";
export type { Config, CueName, TimeOfDay } from "./config";

export interface StartScreenOptions {
  /** Called once, after the doors have closed. Wire this up to whatever comes next. */
  onBegin?: () => void;
  /**
   * Keep the shut doors on screen after onBegin() and slide them open onto whatever
   * the page now shows behind this element (its background turns transparent).
   * Mount the next page in onBegin(); `onRevealed` fires once the doors are open,
   * and is the time to dispose this screen.
   */
  revealAfterBegin?: boolean;
  onRevealed?: () => void;
  /**
   * Sound hook. Called with a cue name at each moment a sound belongs on:
   * "whoosh-doors", "whoosh-island", "letters", "button" (intro), "hover", "flap",
   * "roundel" (pointer), "click", "doors-close" (after BEGIN), "doors-open" (reveal).
   * No audio ships yet.
   */
  onCue?: (cue: CueName) => void;
  /** The letters on the tiles. Defaults to TITLE in config.ts. */
  title?: string;
  /** The name as read aloud and shown without WebGL. Defaults to NAME, or the title. */
  name?: string;
  /** Sea colours, matching the app's time-of-day setting. Default "Day". */
  timeOfDay?: TimeOfDay;
  /**
   * Freeze the intro at this many seconds and draw that one frame. Defaults to
   * the `?t=` query parameter, so `?t=1.2` works wherever this is mounted.
   */
  freezeAt?: number | null;
  /** The same for the sequence after BEGIN. Defaults to `?out=`. */
  freezeOutroAt?: number | null;
  /** Skip the intro and hold the world still. Defaults to the system setting. */
  reducedMotion?: boolean;
}

export interface StartScreenHandle {
  /** Resolves when the scene is on screen (or the HTML fallback is). */
  ready: Promise<void>;
  /** Same as pressing the button. */
  begin(): void;
  dispose(): void;
}

/** Reads `?t=` and `?out=` (seconds). Missing or not a number gives null. */
export function readDebugParams(search: string = globalThis.location?.search ?? ""): { t: number | null; out: number | null } {
  const params = new URLSearchParams(search);
  const seconds = (name: string) => {
    const raw = params.get(name);
    const value = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? Math.max(0, value) : null;
  };
  return { t: seconds("t"), out: seconds("out") };
}

export function mountStartScreen(container: HTMLElement, options: StartScreenOptions = {}): StartScreenHandle {
  const title = options.title ?? CONFIG.title;
  const name =
    options.name ?? (options.title === undefined ? CONFIG.name : title.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()));
  const timeOfDay = options.timeOfDay ?? "Day";
  const debug = readDebugParams();
  const overlay = createOverlay(container, CONFIG, CONFIG.seas[timeOfDay], name);

  let runtime: Runtime | null = null;
  let disposed = false;
  const reducedMotion = options.reducedMotion ?? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const begun = () => {
    if (disposed) return;
    options.onBegin?.();
    if (!options.revealAfterBegin || disposed) return;
    // The doors carry the transition. The island's last frame fades out of the windows
    // while they hold shut; once they start to part, the 3D scene is freed.
    const freeScene = () => {
      runtime?.dispose();
      runtime = null;
    };
    if (reducedMotion) freeScene();
    void overlay
      .reveal(reducedMotion, () => {
        freeScene();
        options.onCue?.("doors-open");
      })
      .then(() => {
        freeScene();
        if (!disposed) options.onRevealed?.();
      });
  };

  const ready = loadFonts().then(() => {
    if (disposed) return;
    try {
      runtime = createRuntime(overlay, {
        title,
        timeOfDay,
        freezeAt: options.freezeAt !== undefined ? options.freezeAt : debug.t,
        freezeOutroAt: options.freezeOutroAt !== undefined ? options.freezeOutroAt : debug.out,
        reducedMotion,
        onBegin: begun,
        onCue: options.onCue,
      });
    } catch (error) {
      // No WebGL2 (or it failed to start): the screen still works as plain HTML.
      console.warn("[start-screen] 3D scene unavailable, using the HTML fallback.", error);
      overlay.showFallback();
      overlay.button.addEventListener("click", begun, { once: true });
    }
  });

  return {
    ready,
    begin: () => runtime?.begin(),
    dispose() {
      disposed = true;
      runtime?.dispose();
      overlay.dispose();
    },
  };
}
