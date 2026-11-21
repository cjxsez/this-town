/** "4:10" from seconds; never negative. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds left until an epoch-ms deadline. */
export const secondsUntil = (at: number | undefined, now: number) => (at === undefined ? 0 : Math.max(0, (at - now) / 1000));

/** "today" / "Nov 19" — the only date detail the app ever shows. */
export function shortDate(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return "today";
  const y = new Date(now - 86400000);
  if (d.toDateString() === y.toDateString()) return "yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "9:46 PM" */
export const timeOfDay = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** "23 h" / "45 min" until an ISO deadline, for auto-deleting memories. */
export function hoursLeft(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, (new Date(iso).getTime() - now) / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)} h`;
  return `${Math.max(1, Math.floor(s / 60))} min`;
}

/** "23:59" hh:mm countdown. */
export function hhmm(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}`;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pronoun helpers for copy like "She'll see your handle". */
export const pron = (p: "she" | "he" | "they") => ({
  subj: p,
  obj: p === "she" ? "her" : p === "he" ? "him" : "them",
  poss: p === "she" ? "her" : p === "he" ? "his" : "their",
  Subj: capitalize(p),
  is: p === "they" ? "they're" : `${p}'s`,
  will: `${p}'ll`,
});
