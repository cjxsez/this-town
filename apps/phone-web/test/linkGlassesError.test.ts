import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/lib/api";
import { linkGlassesErrorMessage } from "../src/lib/linkGlassesError";

test("linkGlassesErrorMessage maps 404/410 to the expired-code line", () => {
  const msg = linkGlassesErrorMessage(new ApiError(404, "unauthorized", { error: "unauthorized" }));
  assert.match(msg, /expired or doesn't match/i);
  assert.doesNotMatch(msg, /unauthorized/i);
  assert.equal(linkGlassesErrorMessage(new ApiError(410, "gone", {})), msg);
});

test("linkGlassesErrorMessage maps timeout and offline to no-signal", () => {
  assert.match(linkGlassesErrorMessage(new ApiError(0, "timeout", null)).toLowerCase(), /no signal/);
  const timed = new ApiError(0, "x", null);
  // code is undefined unless ErrorRes; force via a fake:
  Object.defineProperty(timed, "code", { value: "timeout" });
  assert.match(linkGlassesErrorMessage(timed).toLowerCase(), /no signal/);
  assert.match(linkGlassesErrorMessage(new TypeError("Failed to fetch")).toLowerCase(), /no signal/);
});

test("linkGlassesErrorMessage never returns raw worker error text", () => {
  const msg = linkGlassesErrorMessage(new ApiError(401, "unauthorized", { error: "unauthorized" }));
  assert.doesNotMatch(msg, /unauthorized/i);
  assert.match(msg, /Couldn't link/i);
});
