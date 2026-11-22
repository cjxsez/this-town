import test from "node:test";
import assert from "node:assert/strict";
import { ROOM_STORAGE_TTL_MS, roomStorageExpired } from "../src/rooms/gameRoomExpiry";

test("roomStorageExpired is false inside the TTL window", () => {
  const touchedAt = 1_000_000;
  assert.equal(roomStorageExpired(touchedAt, touchedAt, ROOM_STORAGE_TTL_MS), false);
  assert.equal(roomStorageExpired(touchedAt, touchedAt + ROOM_STORAGE_TTL_MS - 1), false);
});

test("roomStorageExpired is true at and after the TTL", () => {
  const touchedAt = 1_000_000;
  assert.equal(roomStorageExpired(touchedAt, touchedAt + ROOM_STORAGE_TTL_MS), true);
  assert.equal(roomStorageExpired(touchedAt, touchedAt + ROOM_STORAGE_TTL_MS + 1), true);
});

test("roomStorageExpired respects an explicit ttl override", () => {
  assert.equal(roomStorageExpired(0, 59_999, 60_000), false);
  assert.equal(roomStorageExpired(0, 60_000, 60_000), true);
});
