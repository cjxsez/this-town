import { useSyncExternalStore } from "react";

// One shared 1 s ticker for every countdown on screen, instead of one
// interval per component.
let now = Date.now();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      subs.forEach((f) => f());
    }, 250);
  }
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Current epoch ms, re-rendering about four times a second. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => now);
}
