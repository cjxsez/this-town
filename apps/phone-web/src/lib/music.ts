/**
 * music.ts: the waiting song, on loop while a rider is on the Riding screen (C2) waiting
 * for a match. Riding starts it on mount and stops it on unmount, so a match, the ride
 * ending or going offline all stop it. Riders can mute it there (Settings.music).
 *
 * Browsers only allow sound after a user gesture, and iOS Safari refuses play() that isn't
 * inside one. If play() is refused, the song starts on the rider's next touch instead (the
 * same trick as the tap chime in sound.ts). It pauses while the page is hidden and picks up
 * again when the rider comes back.
 *
 * The file is public/sounds/waiting.m4a (TEMPOREX, "Numbers", instrumental), re-encoded
 * to 112 kbps AAC to keep it small on mobile data.
 */

const MUSIC_URL = "/sounds/waiting.m4a";
const VOLUME = 0.55;
const FADE_MS = 400;

let audio: HTMLAudioElement | null = null;
/** Riding is on screen and the rider hasn't muted it. */
let wanted = false;
let waitingForGesture = false;
let fade = 0;

function song(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!audio) {
    audio = new Audio(MUSIC_URL);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = VOLUME;
    document.addEventListener("visibilitychange", () => {
      if (!audio) return;
      if (document.hidden) audio.pause();
      else if (wanted) void tryPlay();
    });
  }
  return audio;
}

function onGesture() {
  waitingForGesture = false;
  window.removeEventListener("pointerdown", onGesture, true);
  window.removeEventListener("keydown", onGesture, true);
  if (wanted) void tryPlay();
}

async function tryPlay(): Promise<void> {
  const a = song();
  if (!a || !wanted) return;
  window.clearInterval(fade);
  a.volume = VOLUME;
  a.muted = false;
  try {
    await a.play();
  } catch {
    if (waitingForGesture) return;
    waitingForGesture = true;
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);
  }
}

/**
 * Call from a button's click handler just before the rider lands on Riding (Turn on Ride
 * Mode, Got it). Starting the element inside a real gesture lets iOS play it later from
 * Riding's effect, so the song starts with the screen instead of on the next touch.
 */
export function unlockWaitingMusic(): void {
  const a = song();
  if (!a || !a.paused) return;
  // Muted while unlocking, so a rider who turned the music off hears nothing.
  a.muted = !wanted;
  a.play().then(
    () => {
      if (!wanted) a.pause();
      a.muted = false;
    },
    () => {
      a.muted = false;
    },
  );
}

/** Play the waiting song on loop (now, or on the next touch if autoplay is blocked). */
export function startWaitingMusic(): void {
  wanted = true;
  void tryPlay();
}

/** Fade the song out and pause it. It resumes where it left off next time. */
export function stopWaitingMusic(): void {
  wanted = false;
  const a = audio;
  if (!a || a.paused) return;
  window.clearInterval(fade);
  // Counted in steps, not by reading volume back: iOS ignores volume (always 1), so there the
  // song just pauses at the end of the fade.
  const steps = FADE_MS / 50;
  let n = 0;
  fade = window.setInterval(() => {
    if (wanted) return window.clearInterval(fade);
    n += 1;
    if (n >= steps) {
      window.clearInterval(fade);
      a.pause();
      a.volume = VOLUME;
    } else {
      a.volume = VOLUME * (1 - n / steps);
    }
  }, 50);
}
