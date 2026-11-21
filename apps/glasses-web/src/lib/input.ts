/**
 * input.ts (glasses-web): Neural Band + temple input, mapped to HUD actions.
 *
 * The glasses Web App has no pointer, no text input, no mic. Everything arrives as
 * keydown events on the page:
 *
 *   Gesture (Neural Band / temple)        Key         InputAction
 *   ------------------------------------  ----------  -----------
 *   thumb swipe up / temple swipe          ArrowUp     "up"
 *   thumb swipe down / temple swipe        ArrowDown   "down"
 *   thumb swipe left / temple swipe back   ArrowLeft   "left"
 *   thumb swipe right / temple swipe fwd   ArrowRight  "right"
 *   select pinch / temple tap              Enter       "select"
 *   back pinch                             Escape      "back"
 *
 * The exact gesture -> key pairs are what we expect from the developer preview; verify
 * on device with `?debug=keys` (logs every keydown to the console) and fix this table.
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
