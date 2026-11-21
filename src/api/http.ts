// Real backend client. Not used until VITE_API_MODE=http; kept compiling so
// wiring the backend is a config flip plus server work.
import type { CheckIn, Profile, ReportReason, SocialBattery, StayInTouch } from "../../shared/types";
import type { ServerEvent } from "../state/ride";
import type { QuestlineApi, RideChannel, RideContext } from "./types";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/**
 * One WebSocket per ride, to the station's Durable Object. Commands go up as
 * {cmd, ...args}; ServerEvents come down. Reconnects with backoff; offers that
 * arrive while disconnected are dropped server-side, never queued.
 */
class WsRide implements RideChannel {
  private ws?: WebSocket;
  private listeners = new Set<(e: ServerEvent) => void>();
  private queue: string[] = [];
  private retry = 0;
  private wanted = false;

  subscribe(fn: (e: ServerEvent) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private open() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/ride/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.emit({ type: "connection", online: true });
      this.queue.splice(0).forEach((m) => ws.send(m));
    };
    ws.onmessage = (m) => this.emit(JSON.parse(m.data) as ServerEvent);
    ws.onclose = () => {
      this.emit({ type: "connection", online: false });
      if (this.wanted) setTimeout(() => this.open(), Math.min(15000, 500 * 2 ** this.retry++));
    };
  }

  private emit(e: ServerEvent) {
    this.listeners.forEach((l) => l(e));
  }

  private send(cmd: string, args: Record<string, unknown> = {}) {
    const msg = JSON.stringify({ cmd, ...args });
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(msg);
    else this.queue.push(msg);
  }

  checkIn(c: CheckIn, ctx: RideContext) {
    this.wanted = true;
    if (!this.ws || this.ws.readyState > WebSocket.OPEN) this.open();
    this.send("checkIn", { checkIn: c, mood: ctx.mood, ghost: ctx.ghost });
  }
  checkOut() {
    this.send("checkOut");
    this.wanted = false;
    this.ws?.close();
  }
  setMood(mood: SocialBattery) { this.send("setMood", { mood }); }
  setGhost(ghost: boolean) { this.send("setGhost", { ghost }); }
  respondOffer(yes: boolean) { this.send("respondOffer", { yes }); }
  withdraw() { this.send("withdraw"); }
  atSpot() { this.send("atSpot"); }
  met() { this.send("met"); }
  startQuest() { this.send("startQuest"); }
  newPrompt() { this.send("newPrompt"); }
  missionDone() { this.send("missionDone"); }
  bump() { this.send("bump"); }
  photoVote(yes: boolean) { this.send("photoVote", { yes }); }
  takePhoto() { this.send("takePhoto"); }
  keepVote(keep: boolean) { this.send("keepVote", { keep }); }
  board() { this.send("board"); }
  keepOnNextStation() { this.send("keepOnNextStation"); }
}

export function createHttpApi(): QuestlineApi {
  return {
    saveProfile: (p: Profile) => call("PUT", "/me", p),
    deleteMyData: () => call("DELETE", "/me"),
    setStayInTouch: (id: string, on: boolean) =>
      call<{ state: StayInTouch }>("PUT", `/people/${id}/stay-in-touch`, { on }).then((r) => r.state),
    report: (id: string, reason: ReportReason, alsoBlock: boolean) => call("POST", `/people/${id}/report`, { reason, alsoBlock }),
    block: (id: string) => call("POST", `/people/${id}/block`),
    unblock: (id: string) => call("DELETE", `/people/${id}/block`),
    voteMemory: (id: string, keep: boolean) => call("PUT", `/memories/${id}/vote`, { keep }),
    ride: new WsRide(),
  };
}
