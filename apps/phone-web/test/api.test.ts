// lib/api.ts against a fake fetch: errors, the timeout, the one retry for reads, and what a
// 401 does to a signed-in device.
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "../src/lib/api";
import { clearToken, getToken, onSignedOut, setToken } from "../src/lib/auth";

type Handler = (url: string, init: RequestInit) => Promise<Response> | Response;
const realFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];

function fakeFetch(...handlers: Handler[]) {
  calls = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const h = handlers[Math.min(calls.length - 1, handlers.length - 1)]!;
    return h(url, init);
  }) as typeof fetch;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  globalThis.fetch = realFetch;
  clearToken();
});

test("a worker error becomes an ApiError with its message and code", async () => {
  fakeFetch(() => json(429, { error: "Wait a minute before asking for another code.", code: "too-soon" }));
  await assert.rejects(api.authStart("a@b.test"), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 429);
    assert.equal(e.code, "too-soon");
    assert.equal(e.message, "Wait a minute before asking for another code.");
    return true;
  });
});

test("a non-JSON error page gets a generic message instead of HTML", async () => {
  fakeFetch(() => new Response("<html>Bad gateway</html>", { status: 502 }));
  await assert.rejects(api.notNow(), (e: unknown) => e instanceof ApiError && e.message === "POST /api/ride/not-now failed (502)");
});

test("the bearer token rides along on signed-in requests and not on sign-in", async () => {
  setToken("tok-1");
  fakeFetch(() => json(200, { ok: true }));
  await api.notNow();
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer tok-1");
  await api.authStart("a@b.test");
  assert.equal((calls[1]!.init.headers as Record<string, string>).Authorization, undefined);
});

test("a read that hits a server error is retried once", async () => {
  fakeFetch(
    () => json(503, { error: "busy" }),
    () => json(200, { matches: [] }),
  );
  assert.deepEqual(await api.getRecentMatches(), { matches: [] });
  assert.equal(calls.length, 2);
});

test("a read that fails twice gives up with the second error", async () => {
  fakeFetch(() => json(500, { error: "down" }));
  await assert.rejects(api.getRecentMatches(), (e: unknown) => e instanceof ApiError && e.status === 500);
  assert.equal(calls.length, 2);
});

test("writes are never retried, so a tap can't count twice", async () => {
  fakeFetch(() => json(503, { error: "busy" }));
  await assert.rejects(api.arrived());
  assert.equal(calls.length, 1);
});

test("a 4xx read is not retried", async () => {
  fakeFetch(() => json(404, { error: "nope" }));
  await assert.rejects(api.getRecentMatches());
  assert.equal(calls.length, 1);
});

test("a dropped connection is an ApiError with status 0 and code offline", async () => {
  fakeFetch(() => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(api.notNow(), (e: unknown) => e instanceof ApiError && e.status === 0 && e.code === "offline");
});

test("a request that never answers is aborted and reported as a timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  fakeFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  const pending = api.notNow();
  t.mock.timers.tick(8_000);
  await assert.rejects(pending, (e: unknown) => e instanceof ApiError && e.status === 0 && e.code === "timeout");
});

test("a 401 to a signed-in request drops the token and tells the app, once", async () => {
  setToken("stale");
  let told = 0;
  const off = onSignedOut(() => told++);
  fakeFetch(() => json(401, { error: "unauthorized" }));
  await assert.rejects(api.notNow());
  await assert.rejects(api.notNow()); // token already gone: no second sign-out
  off();
  assert.equal(getToken(), null);
  assert.equal(told, 1);
});

test("a 401 without a token (sign-in screens) doesn't sign anyone out", async () => {
  let told = 0;
  const off = onSignedOut(() => told++);
  fakeFetch(() => json(401, { error: "bad code" }));
  await assert.rejects(api.authVerify("a@b.test", "000000"));
  off();
  assert.equal(told, 0);
});

test("adding an email posts the code with the guest's token and returns their profile", async () => {
  setToken("guest-tok");
  const me = { userId: "usr_1", profile: { firstName: "Gus", interests: ["chess", "anime", "trivia"], askMeAbout: "", socialBattery: "chat", status: "student", languages: [], is18Plus: true }, glassesLinked: false, email: "gus@example.test" };
  fakeFetch(() => json(200, me));
  const res = await api.attachEmail("gus@example.test", "123456");
  assert.equal(res.email, "gus@example.test");
  assert.equal(calls[0]!.url, "/api/me/email");
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { email: "gus@example.test", code: "123456" });
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer guest-tok");
});

test("an email another account uses comes back as code email-taken", async () => {
  setToken("guest-tok");
  fakeFetch(() => json(409, { error: "That email already has an account.", code: "email-taken" }));
  await assert.rejects(api.attachEmail("taken@example.test", "123456"), (e: unknown) => e instanceof ApiError && e.code === "email-taken");
});
