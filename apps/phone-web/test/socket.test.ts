// lib/socket.ts with a fake WebSocket: hello on open, and which closes are worth reconnecting after.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { WS_CLOSE } from "@questline/protocol";

class FakeSocket {
  static OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen?: () => void;
  onclose?: (ev: { code: number }) => void;
  onmessage?: (ev: { data: string }) => void;
  onerror?: () => void;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const g = globalThis as Record<string, unknown>;
beforeEach(() => {
  FakeSocket.all = [];
  g.WebSocket = FakeSocket;
  g.location = { protocol: "https:", host: "town.test" };
  g.document = { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" };
  g.window = { addEventListener() {}, removeEventListener() {} };
});
// The fakes stay installed between tests (beforeEach replaces them): each test's
// t.after(sock.close) still needs document and window when it runs.

const { connectRiderSocket } = await import("../src/lib/socket");

test("it connects with the token over wss and says hello as the phone", (t) => {
  const sock = connectRiderSocket("tok 1", { onEvent() {} });
  t.after(() => sock.close());
  const ws = FakeSocket.all[0]!;
  assert.equal(ws.url, "wss://town.test/ws/rider?token=tok%201");
  ws.open();
  assert.deepEqual(JSON.parse(ws.sent[0]!), { type: "rider.hello", client: "phone" });
});

test("a dropped connection is retried", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const sock = connectRiderSocket("tok", { onEvent() {} });
  t.after(() => sock.close());
  FakeSocket.all[0]!.open();
  FakeSocket.all[0]!.drop(1006);
  t.mock.timers.tick(20_000);
  assert.equal(FakeSocket.all.length, 2);
});

for (const [name, code] of [
  ["checked out", WS_CLOSE.checkedOut],
  ["no ride", WS_CLOSE.noRide],
  ["forbidden", WS_CLOSE.forbidden],
] as const) {
  test(`after "${name}" (${code}) it stops reconnecting and reports closed`, (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const statuses: string[] = [];
    const sock = connectRiderSocket("tok", { onEvent() {}, onStatus: (s) => statuses.push(s) });
    t.after(() => sock.close());
    FakeSocket.all[0]!.open();
    FakeSocket.all[0]!.drop(code);
    t.mock.timers.tick(60_000);
    assert.equal(FakeSocket.all.length, 1);
    assert.equal(statuses.at(-1), "closed");
  });
}

test("events are validated before they reach the app", (t) => {
  const got: string[] = [];
  const sock = connectRiderSocket("tok", { onEvent: (e) => got.push(e.type) });
  t.after(() => sock.close());
  const ws = FakeSocket.all[0]!;
  ws.open();
  ws.onmessage?.({ data: JSON.stringify({ type: "match.cleared", matchId: "m", reason: "partner-left" }) });
  ws.onmessage?.({ data: JSON.stringify({ type: "made.up" }) });
  ws.onmessage?.({ data: "not json" });
  assert.deepEqual(got, ["match.cleared"]);
});

test("send reports false while the socket isn't open, so callers use the REST twin", (t) => {
  const sock = connectRiderSocket("tok", { onEvent() {} });
  t.after(() => sock.close());
  assert.equal(sock.send({ type: "rider.notNow" }), false);
  FakeSocket.all[0]!.open();
  assert.equal(sock.send({ type: "rider.notNow" }), true);
});
