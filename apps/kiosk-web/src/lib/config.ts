/**
 * config.ts (kiosk-web): which car this kiosk is in, and its shared key.
 *
 * URL shape: /kiosk/:car?key=<KIOSK_KEY>
 *   - car: first path segment after the Vite base ("/kiosk/"), validated like CarId
 *     in packages/protocol (/^[A-Za-z0-9-]{1,12}$/, the MBTA carriage label, e.g. "1412").
 *   - key: from ?key=, saved to localStorage so a reload without the query still works.
 *     Falls back to localStorage when ?key= is absent.
 *
 * The key authenticates /ws/kiosk/:car?key=&role=screen (lib/socket.ts). It is the same
 * KIOSK_KEY the Pi agent uses (architecture.md "Identity").
 *
 * TODO:
 * - Strip ?key= from the URL with history.replaceState after saving it (no URL bar in
 *   kiosk mode, but keeps it out of screenshots of the dev browser).
 */

export interface KioskConfig {
  car: string;
  key: string;
}

export type ConfigResult = { ok: true; config: KioskConfig } | { ok: false; error: string; car: string | null };

const KEY_STORAGE = "questline.kiosk.key";
const CAR_RE = /^[A-Za-z0-9-]{1,12}$/;

function loadKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

function saveKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    // Storage blocked: the Pi launcher always passes ?key=, so this is fine.
  }
}

export function parseCar(pathname: string, base: string = import.meta.env.BASE_URL): string | null {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\/+/, "");
  let segment: string;
  try {
    segment = decodeURIComponent(rest.split("/")[0] ?? "");
  } catch {
    return null;
  }
  return CAR_RE.test(segment) ? segment : null;
}

export function readConfig(loc: Location = window.location): ConfigResult {
  const car = parseCar(loc.pathname);
  const fromQuery = new URLSearchParams(loc.search).get("key");
  if (fromQuery) saveKey(fromQuery);
  const key = fromQuery ?? loadKey();

  if (!car) return { ok: false, error: "No car in URL. Expected /kiosk/<car>", car: null };
  if (!key) return { ok: false, error: "No kiosk key. Add ?key=…", car };
  return { ok: true, config: { car, key } };
}
