/**
 * input.ts (glasses-web): temple touch strip input, mapped to HUD actions.
 *
 * WE HAVE NO NEURAL BAND. The app is designed to work with zero input: every screen is
 * driven by server events, arrival is proven by tapping the kiosk tag, and "Not now" lives
 * on the phone. Input here is a bonus.
 *
 * Meta's docs: the temple touch strip "senses swipe gestures" and, like the Neural Band,
 * "translates to standard arrow key (ArrowUp, ArrowDown, ArrowLeft, ArrowRight) and Enter
 * events". A middle tap opens the system menu (Restart / Resume / Permissions), so we never
 * rely on it. Which touch gesture sends Enter, and whether Back reaches the page as Escape,
 * is not documented: verify on device with `?debug=keys` and fix this table.
 *
 *   Touch strip (expected)                 Key         InputAction
 *   ------------------------------------  ----------  -----------
 *   swipe up                               ArrowUp     "up"
 *   swipe down                             ArrowDown   "down"
 *   swipe back                             ArrowLeft   "left"
 *   swipe forward                          ArrowRight  "right"
 *   tap (verify)                           Enter       "select"
 *   back (verify, may close the app)       Escape      "back"
 *
 * What each action does per screen (screens own their handlers via useInput):
 *
 *   LinkCode   select: request a fresh code if the current one failed
 *   Idle       (nothing yet)
 *   MatchCard  left/right/up/down: move focus between "I'm here" and "Not now"
 *              select: activate focused button. Default focus is "I'm here", so a plain
 *                      select pinch sends rider.arrived
 *              back:   "Not now" -> rider.notNow (10 min cooldown, partner is rematched)
 *   Mission    (display only; taps prove arrival)
 *   Stamp      select/back: dismiss early (auto-dismisses anyway)
 *   Offline    select: retry now
 *   Games      (src/play/*) left/up: previous choice or slider step down, right/down:
 *              next or step up, select: choose, lock in, ready, done.
 *              They also take wheel and click (pointer mode below), so they work from the
 *              frame whether the strip's scroll arrives as arrow keys or as scroll events.
 *   EndButtons (last screen of each game) left/up: "Next game", right/down: "Again",
 *              select: activate.
 *
 * "Not now" is always one action away (architecture: safety and privacy): either the back
 * gesture, or focus the "Not now" button and pinch select.
 *
 * Uses no API routes or protocol events directly; screens call back into App, which sends
 * rider.arrived / rider.notNow over the socket.
 *
 * TODO:
 * - Verify on device whether Escape reaches the page or is consumed by the system (it may
 *   close the Web App). If it closes the app, drop "back = Not now" and rely on the button.
 * - Decide whether back during a Mission should send rider.notNow (cancel) or do nothing.
 *
 * Hidden unlink (hold back on Idle for 3 s) is skipped until on-device testing confirms
 * Escape reaches the page. If the system consumes Back and closes the Web App, a hold
 * gesture would never fire — and clearing the token without a confirmed input path is worse
 * than asking the rider to clear site data. Revisit after `?debug=keys` on the glasses.
 */
import { useEffect, useRef } from "react";

export type InputAction = "up" | "down" | "left" | "right" | "select" | "back";

const KEY_TO_ACTION: Record<string, InputAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "select",
  Escape: "back",
};

const DEBUG_KEYS =
  typeof location !== "undefined" && new URLSearchParams(location.search).get("debug") === "keys";

export function keyToAction(key: string): InputAction | null {
  return KEY_TO_ACTION[key] ?? null;
}

/** Wheel travel that counts as one scroll step. A notched mouse wheel sends about 100 per notch. */
const WHEEL_STEP_PX = 60;

interface InputOptions {
  /**
   * Also read scroll (wheel) as arrows and a tap (click) as select. For screens that must
   * work from the frame alone when the strip's scroll does not arrive as arrow keys.
   * Opt-in: on other screens a stray click must not fire the focused button.
   */
  pointer?: boolean;
}

/**
 * Subscribe the current screen to input actions. Return `false` from the handler to let
 * the browser keep the default behavior for that key; anything else prevents default.
 */
export function useInput(handler: (action: InputAction) => boolean | void, { pointer = false }: InputOptions = {}): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    if (!pointer) return;
    let travel = 0;
    function onWheel(e: WheelEvent) {
      if (DEBUG_KEYS) console.log("[input] wheel", { deltaX: e.deltaX, deltaY: e.deltaY });
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = horizontal ? e.deltaX : e.deltaY;
      // A new direction starts a new step, so a small correction is not swallowed.
      if (Math.sign(delta) !== Math.sign(travel)) travel = 0;
      travel += delta;
      // One event moves at most one step: a wheel notch is one step, a slow drag adds up to one.
      if (Math.abs(travel) >= WHEEL_STEP_PX) {
        handlerRef.current(travel > 0 ? (horizontal ? "right" : "down") : horizontal ? "left" : "up");
        travel = 0;
      }
      e.preventDefault();
    }
    function onClick() {
      if (DEBUG_KEYS) console.log("[input] click");
      handlerRef.current("select");
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("click", onClick);
    };
  }, [pointer]);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (DEBUG_KEYS) console.log("[input] keydown", { key: e.key, code: e.code, repeat: e.repeat });
      if (e.repeat) return;
      const action = keyToAction(e.key);
      if (!action) return;
      const handled = handlerRef.current(action);
      if (handled !== false) e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
