import test from "node:test";
import assert from "node:assert/strict";
import { base64url, fourDigitCode, newId, newToken, orderedPair, pairKey, sha256Hex, sixDigitCode } from "../src/lib/ids";

test("ids carry their prefix and 32 hex characters", () => {
  assert.match(newId("mat"), /^mat_[0-9a-f]{32}$/);
  assert.notEqual(newId("usr"), newId("usr"));
});

test("tokens are 32 random bytes in URL-safe base64", () => {
  const t = newToken();
  assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(base64url(new Uint8Array([251, 255])), "-_8");
});

test("glasses and sign-in codes are always 4 and 6 digits, zero-padded", () => {
  for (let i = 0; i < 500; i++) {
    assert.match(fourDigitCode(), /^\d{4}$/);
    assert.match(sixDigitCode(), /^\d{6}$/);
  }
});

test("sha256Hex matches the known digest", async () => {
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("a pair key is the same whichever rider comes first", () => {
  assert.deepEqual(orderedPair("b", "a"), ["a", "b"]);
  assert.equal(pairKey("usr_2", "usr_1"), pairKey("usr_1", "usr_2"));
  assert.equal(pairKey("usr_1", "usr_2"), "usr_1:usr_2");
});
