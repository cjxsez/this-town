/**
 * sound.ts: the chime when a rider opens a kiosk tag link (/k/:car).
 *
 * Browsers only allow sound after the page has had a user gesture. Opening a link from an
 * NFC tag usually doesn't count (iOS Safari always blocks it), so if play() is refused we
 * play the chime on the rider's first touch instead. The listener is on the window, not a
 * component, so it survives the signed-out redirect from /k/:car to /signin.
 */

const TAP_SOUND_URL = "/sounds/tap.mp3";

let audio: HTMLAudioElement | null = null;
let lastPlayedAt = 0;
let waitingForGesture = false;

function chime(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!audio) {
    audio = new Audio(TAP_SOUND_URL);
    audio.preload = "auto";
  }
  return audio;
}

function play(a: HTMLAudioElement): Promise<void> {
  a.currentTime = 0;
  return a.play();
}

/** Play the tap chime now, or on the first touch if the browser blocks autoplay. */
export function playTapSound(): void {
  const a = chime();
  if (!a) return;
  // StrictMode runs effects twice, and a pending-tap replay remounts Tap: one chime per tap.
  const now = Date.now();
  if (now - lastPlayedAt < 2000) return;
  lastPlayedAt = now;

  play(a).catch(() => {
    if (waitingForGesture) return;
    waitingForGesture = true;
    const onGesture = () => {
      waitingForGesture = false;
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      play(a).catch(() => {});
    };
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);
  });
}
