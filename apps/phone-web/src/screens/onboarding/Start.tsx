import { useEffect, useEffectEvent, useRef } from "react";
import { useApp } from "../../state/store";

/**
 * The 3D start screen (packages/start-screen): doors open on the little island,
 * IN THIS TOWN flips in, BEGIN closes the doors and calls `onBegin`. The app mounts
 * the next page behind the shut doors; they hold for a beat, slide open onto it,
 * and then `onRevealed` fires.
 *
 * three.js is loaded only here, so it stays out of the app's first load. If that
 * download fails (offline), the rider is sent straight on instead of stuck.
 */
export default function Start({
  onBegin,
  onRevealed,
  revealing,
}: {
  onBegin: () => void;
  onRevealed: () => void;
  /** True once BEGIN was pressed: this box turns see-through so the doors open onto the page. */
  revealing: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { timeOfDay, motion } = useApp().state.settings;
  // The latest callbacks, without rebuilding the scene when the parent re-renders.
  const begin = useEffectEvent(onBegin);
  const revealed = useEffectEvent(onRevealed);

  useEffect(() => {
    let screen: { dispose(): void } | undefined;
    let gone = false;
    import("@questline/start-screen")
      .then(({ mountStartScreen }) => {
        if (gone || !ref.current) return;
        screen = mountStartScreen(ref.current, {
          revealAfterBegin: true,
          onBegin: () => begin(),
          onRevealed: () => revealed(),
          timeOfDay,
          // Me > Motion off skips the intro and opens the doors at once; otherwise the system setting decides.
          reducedMotion: motion ? undefined : true,
        });
      })
      .catch((error: unknown) => {
        console.warn("[start] could not load the start screen, skipping it", error);
        if (gone) return;
        begin();
        revealed();
      });
    return () => {
      gone = true;
      screen?.dispose();
    };
    // Mount once per visit: a settings change mid-transition must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className={`q-start${revealing ? " q-start--revealing" : ""}`} data-screen="start" />;
}
