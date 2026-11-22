/**
 * Fails CI when wrangler.toml gains a [vars] key or binding that Env / readConfig miss.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const toml = readFileSync(join(root, "wrangler.toml"), "utf8");
const envSrc = readFileSync(join(root, "src/env.ts"), "utf8");

/** Collect binding names and [vars] keys from wrangler.toml (enough for our layout). */
export function wranglerBindingsAndVars(source: string): { bindings: string[]; vars: string[] } {
  const bindings: string[] = [];
  const vars: string[] = [];
  let section = "";
  for (const raw of source.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sec = line.match(/^\[\[?([^\]\[]+)\]\]?$/);
    if (sec) {
      section = sec[1].trim();
      continue;
    }
    if (section === "vars") {
      const m = line.match(/^([A-Z][A-Z0-9_]*)\s*=/);
      if (m) vars.push(m[1]!);
      continue;
    }
    if (section === "assets" || section === "d1_databases" || section === "r2_buckets" || section === "version_metadata") {
      const m = line.match(/^binding\s*=\s*"([^"]+)"/);
      if (m) bindings.push(m[1]!);
      continue;
    }
    if (section === "durable_objects.bindings" || section === "send_email") {
      const m = line.match(/^name\s*=\s*"([^"]+)"/);
      if (m) bindings.push(m[1]!);
    }
  }
  return { bindings, vars };
}

function envInterfaceBody(source: string): string {
  const start = source.indexOf("export interface Env");
  assert.ok(start >= 0, "Env interface missing");
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(brace, i + 1);
    }
  }
  throw new Error("unclosed Env interface");
}

function readConfigBody(source: string): string {
  const start = source.indexOf("export function readConfig");
  assert.ok(start >= 0, "readConfig missing");
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(brace, i + 1);
    }
  }
  throw new Error("unclosed readConfig");
}

test("wrangler.toml bindings and [vars] are declared on Env", () => {
  const { bindings, vars } = wranglerBindingsAndVars(toml);
  assert.ok(bindings.length >= 4, `expected bindings, got ${bindings.join(",")}`);
  assert.ok(vars.length >= 5, `expected vars, got ${vars.join(",")}`);
  const body = envInterfaceBody(envSrc);
  for (const name of [...bindings, ...vars]) {
    assert.match(body, new RegExp(`\\b${name}\\b`), `${name} missing from Env interface`);
  }
});

test("wrangler.toml [vars] are read in readConfig", () => {
  const { vars } = wranglerBindingsAndVars(toml);
  const body = readConfigBody(envSrc);
  for (const name of vars) {
    assert.match(body, new RegExp(`env\\.${name}\\b`), `${name} missing from readConfig`);
  }
});

test("wranglerBindingsAndVars finds the known worker bindings", () => {
  const { bindings, vars } = wranglerBindingsAndVars(toml);
  for (const b of ["ASSETS", "DB", "MEDIA", "TRAIN_ROOM", "GAME_ROOM", "EMAIL", "CF_VERSION_METADATA"]) {
    assert.ok(bindings.includes(b), `missing binding ${b}`);
  }
  assert.ok(vars.includes("GAMES_ONLY"));
  assert.ok(vars.includes("EMAIL_FROM"));
});
