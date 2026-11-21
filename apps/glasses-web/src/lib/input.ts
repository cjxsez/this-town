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
 *   Mission    (nothing yet, see TODO)
 *   Stamp      select/back: dismiss early (auto-dismisses anyway)
 *   Offline    select: retry now
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
 * - Hidden "unlink glasses" gesture (e.g. hold back on Idle for 3 s) that clears the token.
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

const DEBUG_KEYS = new URLSearchParams(location.search).get("debug") === "keys";

export function keyToAction(key: string): InputAction | null {
  return KEY_TO_ACTION[key] ?? null;
}

/**
 * Subscribe the current screen to input actions. Return `false` from the handler to let
 * the browser keep the default behavior for that key; anything else prevents default.
 */
export function useInput(handler: (action: InputAction) => boolean | void): void {
  const handlerRef = useRef(handler);

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
