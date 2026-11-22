import test from "node:test";
import assert from "node:assert/strict";
import { newNonce, nonceMatches, tagUrl } from "../src/nfc";

test("tagUrl is origin/k/car, with optional nonce query", () => {
  assert.equal(tagUrl("https://example.com/", "1413"), "https://example.com/k/1413");
  assert.equal(tagUrl("https://example.com", "1412", "abc"), "https://example.com/k/1412?n=abc");
  assert.equal(tagUrl("https://example.com", "1412", null), "https://example.com/k/1412");
});

test("nonceMatches is length-safe and rejects missing values", () => {
  const n = "abcdefghijkl";
  assert.equal(nonceMatches(n, n), true);
  assert.equal(nonceMatches(n, "abcdefghijkX"), false);
  assert.equal(nonceMatches(n, "short"), false);
  assert.equal(nonceMatches(null, n), false);
  assert.equal(nonceMatches(n, undefined), false);
});

test("newNonce is URL-safe and long enough for the tag", () => {
  const a = newNonce();
  const b = newNonce();
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(a.length >= 12);
  assert.notEqual(a, b);
});
