import { useEffect } from "react";
import { useApp } from "../state/store";
import { startWaitingMusic, stopWaitingMusic } from "./music";

/**
 * Keep the waiting song (lib/music.ts) playing while `active` and the rider hasn't muted it
 * (Settings.music). Used by every screen between Ride Mode on and the first game: Riding
 * (C2), the match screen (Meet), and /m until the pair's game starts. Moving from one of
 * these screens to the next doesn't restart the song: the old screen's stop and the new
 * screen's start land in the same React commit, so the fade is cancelled before it begins.
 */
export function useWaitingMusic(active: boolean): void {
  const music = useApp().state.settings.music !== false;
  const on = active && music;
  useEffect(() => {
    if (!on) return;
    startWaitingMusic();
    return stopWaitingMusic;
  }, [on]);
}
