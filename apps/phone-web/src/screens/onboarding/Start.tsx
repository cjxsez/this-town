import { useEffect, useEffectEvent, useRef } from "react";
import { useApp } from "../../state/store";

/**
 * The 3D start screen (packages/start-screen): doors open on the little island,
 * IN THIS TOWN flips in, BEGIN closes the doors and calls `onBegin`.
 *
 * three.js is loaded only here, so it stays out of the app's first load. If that
 * download fails (offline), the rider is sent straight on instead of stuck.
 */
export default function Start({ onBegin }: { onBegin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { timeOfDay, motion } = useApp().state.settings;
  // The latest onBegin, without rebuilding the scene when the parent re-renders.
  const begin = useEffectEvent(onBegin);

  useEffect(() => {
    let screen: { dispose(): void } | undefined;
    let gone = false;
    import("@questline/start-screen")
      .then(({ mountStartScreen }) => {
        if (gone || !ref.current) return;
        screen = mountStartScreen(ref.current, {
          onBegin: () => begin(),
          timeOfDay,
          // Me > Motion off skips the intro; otherwise the system setting decides.
          reducedMotion: motion ? undefined : true,
        });
      })
      .catch((error: unknown) => {
        console.warn("[start] could not load the start screen, skipping it", error);
        if (!gone) begin();
      });
    return () => {
      gone = true;
      screen?.dispose();
    };
  }, [timeOfDay, motion]);

  return <div ref={ref} className="q-start" data-screen="start" />;
}
