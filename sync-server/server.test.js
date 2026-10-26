"use strict";

// Run with `npm test` in this folder (Node's built-in test runner; no extra dependencies).

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("./server.js");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const TOKEN = "test-token";

let dataDir, server, base, clock;

beforeEach(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pokedex-sync-"));
  clock = Date.parse("2026-10-11T14:05:00.000Z");
  const app = createApp({ token: TOKEN, user: "ash", password: "pikachu-é", dataDir, now: () => clock });
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function call(method, url, { body, token = TOKEN, raw } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: res.status, json: await res.json() };
}
const push = (data, extra = {}) => call("POST", "/api/push", { body: { data, ...extra } });
const pull = () => call("GET", "/api/pull");

// ── Snapshots ────────────────────────────────────────────────────────────────

/** Hourly snapshot ids only (the recent per-push ones have minutes in them) */
const hourlyIds = (list) => list.map((s) => s.id).filter((id) => id.length === 13);

test("a push keeps the copy it replaces, once per hour", async () => {
  await push({ n: 1 });
  assert.deepEqual((await call("GET", "/api/snapshots")).json.snapshots, [], "nothing to keep before the first push");

  clock += 10 * 60 * 1000;
  await push({ n: 2 });
  clock += 10 * 60 * 1000;
  await push({ n: 3 });

  const list = (await call("GET", "/api/snapshots")).json.snapshots;
  assert.deepEqual(hourlyIds(list), ["2026-10-11T14"]);
  const hourly = list.find((s) => s.id === "2026-10-11T14");
  assert.equal(hourly.savedAt, "2026-10-11T14:05:00.000Z");

  const snapshot = await call("GET", `/api/snapshots/${hourly.id}`);
  assert.equal(snapshot.status, 200);
  assert.deepEqual(snapshot.json.data, { n: 1 });

  clock += HOUR;
  await push({ n: 4 });
  const later = (await call("GET", "/api/snapshots")).json.snapshots;
  assert.deepEqual(hourlyIds(later), ["2026-10-11T15", "2026-10-11T14"]);
  assert.deepEqual((await call("GET", "/api/snapshots/2026-10-11T15")).json.data, { n: 3 });
  assert.deepEqual((await pull()).json.data, { n: 4 });
});

test("the copies replaced by the last 10 pushes are kept too, so a bad push can be undone to just before it", async () => {
  await push({ n: 0 });
  for (let i = 1; i <= 14; i++) {
    clock += 60 * 1000;
    await push({ n: i });
  }
  const list = (await call("GET", "/api/snapshots")).json.snapshots;
  const recent = list.filter((s) => s.id.length > 13);
  assert.equal(recent.length, 10);
  // Newest first: the copy the last push replaced is n: 13, pushed a minute earlier
  assert.equal(recent[0].id, "2026-10-11T14-19-00-000");
  assert.deepEqual((await call("GET", `/api/snapshots/${recent[0].id}`)).json.data, { n: 13 });
  // The hourly copy and the recent copy of the first push hold the same data: listed once
  assert.equal(new Set(list.map((s) => s.savedAt)).size, list.length);
});

test("old snapshots are thinned to one a day, and dropped after 30 days", async () => {
  await push({ n: 0 });
  // A push every hour for 40 days
  for (let i = 1; i <= 40 * 24; i++) {
    clock += HOUR;
    await push({ n: i });
  }
  const ids = hourlyIds((await call("GET", "/api/snapshots")).json.snapshots);
  const age = (id) => clock - Date.parse(`${id}:00:00.000Z`);

  const hourly = ids.filter((id) => age(id) <= DAY);
  const daily = ids.filter((id) => age(id) > DAY);
  assert.equal(hourly.length, 24, "every hour of the last day");
  assert.ok(daily.every((id) => age(id) <= 30 * DAY), "nothing older than 30 days");
  assert.equal(new Set(daily.map((id) => id.slice(0, 10))).size, daily.length, "one per day beyond the last day");
  assert.ok(daily.length >= 29 && daily.length <= 30);
});

test("snapshots need the token and a well-formed id", async () => {
  await push({ n: 1 });
  clock += HOUR;
  await push({ n: 2 });
  assert.equal((await call("GET", "/api/snapshots", { token: "" })).status, 401);
  assert.equal((await call("GET", "/api/snapshots/2026-10-11T15", { token: "wrong" })).status, 401);
  assert.equal((await call("GET", "/api/snapshots/2026-10-11T09")).status, 404);
  assert.equal((await call("GET", "/api/snapshots/..%2Fsync")).status, 404);
  assert.equal((await call("GET", "/api/snapshots/sync")).status, 404);
});

// ── Login ────────────────────────────────────────────────────────────────────

test("login answers only its exact path, so nginx's login rate limit can't be sidestepped", async () => {
  const credentials = { username: "ash", password: "pikachu-é" };
  assert.equal((await call("POST", "/api/login", { body: credentials, token: null })).status, 200);
  for (const variant of ["/api/Login", "/API/LOGIN", "/api/login/"]) {
    const { status, json } = await call("POST", variant, { body: credentials, token: null });
    assert.equal(status, 404, variant);
    assert.equal(json.token, undefined, variant);
  }
});

test("pull and push answer only their exact paths", async () => {
  assert.equal((await call("GET", "/api/Pull")).status, 404);
  assert.equal((await call("GET", "/api/pull/")).status, 404);
  assert.equal((await call("POST", "/API/push", { body: { data: { n: 1 } } })).status, 404);
});

test("login hands out the token for the right credentials only", async () => {
  const login = (username, password) => call("POST", "/api/login", { token: "", body: { username, password } });

  const good = await login("ash", "pikachu-é");
  assert.equal(good.status, 200);
  assert.equal(good.json.token, TOKEN);

  assert.equal((await login("ash", "pikachu-e")).status, 401);
  assert.equal((await login("gary", "pikachu-é")).status, 401);
  assert.equal((await login("ash", "")).status, 400);
  assert.equal((await login("ash", 12345)).status, 400);
  assert.equal((await call("POST", "/api/login", { token: "", body: {} })).status, 400);
});

test("a long password is compared in full, not by its first characters", async () => {
  const long = "x".repeat(200);
  const app = createApp({ token: TOKEN, user: "ash", password: long + "!", dataDir });
  const other = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  try {
    const url = `http://127.0.0.1:${other.address().port}/api/login`;
    const attempt = (password) => fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "ash", password }),
    }).then((res) => res.status);
    assert.equal(await attempt(long), 401);
    assert.equal(await attempt(long + "!"), 200);
  } finally {
    await new Promise((resolve) => other.close(resolve));
  }
});

test("without a token configured, login and sync are switched off", async () => {
  const app = createApp({ dataDir });
  const other = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  try {
    const root = `http://127.0.0.1:${other.address().port}`;
    assert.deepEqual(await fetch(`${root}/health`).then((r) => r.json()), { ok: true, loginEnabled: false, syncEnabled: false });
    assert.equal((await fetch(`${root}/api/pull`)).status, 503);
    assert.equal((await fetch(`${root}/api/login`, { method: "POST" })).status, 503);
  } finally {
    await new Promise((resolve) => other.close(resolve));
  }
});

// ── Auth ─────────────────────────────────────────────────────────────────────

test("pull and push need the token", async () => {
  for (const token of ["", "wrong", TOKEN + "x", TOKEN.slice(0, -1)]) {
    assert.equal((await call("GET", "/api/pull", { token })).status, 401, `pull with "${token}"`);
    assert.equal((await call("POST", "/api/push", { token, body: { data: { n: 1 } } })).status, 401, `push with "${token}"`);
  }
  assert.deepEqual((await pull()).json, { ok: true, data: null, savedAt: null, version: 0, serverTime: clock });
  assert.equal(fs.existsSync(path.join(dataDir, "sync.json")), false, "a refused push writes nothing");
});

test("health needs no token and says login is available", async () => {
  const health = await call("GET", "/health", { token: "" });
  assert.deepEqual(health.json, { ok: true, loginEnabled: true, syncEnabled: true });
});

// ── Push validation ──────────────────────────────────────────────────────────

test("push refuses anything that isn't a JSON object, with a JSON error", async () => {
  for (const body of [{}, { data: null }, { data: "text" }, { data: 5 }, { data: [1, 2] }]) {
    const res = await call("POST", "/api/push", { body });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(typeof res.json.error, "string");
  }
  const malformed = await call("POST", "/api/push", { raw: "{not json" });
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.json, { error: "Bad request" });

  const huge = await call("POST", "/api/push", { body: { data: { blob: "x".repeat(5 * 1024 * 1024) } } });
  assert.equal(huge.status, 413);
  assert.deepEqual(huge.json, { error: "Payload too large" });

  assert.equal((await call("POST", "/api/push", { body: { data: { n: 1 }, baseVersion: "1" } })).status, 400);
  assert.equal((await pull()).json.data, null);
});

test("a compressed body is refused, not decompressed", async () => {
  const zlib = require("node:zlib");
  const res = await fetch(base + "/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Encoding": "gzip", Authorization: `Bearer ${TOKEN}` },
    body: zlib.gzipSync(JSON.stringify({ data: { n: 1 } })),
  });
  assert.equal(res.status, 415);
  assert.deepEqual(await res.json(), { error: "Bad request" });
  assert.equal((await pull()).json.data, null);
});

test("listing snapshots reads savedAt from the end of each file, and copes with odd files", async () => {
  await push({ note: 'a "quoted" "savedAt":"fake" value' });
  clock += HOUR;
  await push({ n: 2 });
  const listed = (await call("GET", "/api/snapshots")).json.snapshots;
  assert.equal(listed.find((s) => s.id === "2026-10-11T15").savedAt, "2026-10-11T14:05:00.000Z");
  // A file in another layout still lists, through the full read
  fs.writeFileSync(path.join(dataDir, "snapshots", "2026-10-11T13.json"), JSON.stringify({ savedAt: "2026-10-11T12:00:00.000Z", data: {} }));
  const again = (await call("GET", "/api/snapshots")).json.snapshots;
  assert.equal(again.find((s) => s.id === "2026-10-11T13").savedAt, "2026-10-11T12:00:00.000Z");
});

test("unknown paths are a JSON 404", async () => {
  const res = await call("GET", "/api/restart");
  assert.equal(res.status, 404);
  assert.deepEqual(res.json, { error: "Not found" });
});

test("only the iOS app and configured origins get a CORS origin header", async () => {
  const other = await fetch(base + "/health", { headers: { Origin: "https://evil.example" } });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
  const none = await fetch(base + "/health");
  assert.equal(none.headers.get("access-control-allow-origin"), null);
});

test("a preflight is answered for any path, with the CORS headers the iOS app needs", async () => {
  for (const url of ["/api/push", "/api/snapshots/2026-10-11T14", "/"]) {
    const res = await fetch(base + url, { method: "OPTIONS", headers: { Origin: "capacitor://localhost" } });
    assert.equal(res.status, 204, url);
    assert.equal(res.headers.get("access-control-allow-origin"), "capacitor://localhost", url);
    assert.match(res.headers.get("access-control-allow-headers"), /Authorization/, url);
  }
});

// ── Versions ─────────────────────────────────────────────────────────────────

test("a push round-trips and bumps the version", async () => {
  const first = await push({ n: 1 }, { baseVersion: 0 });
  assert.equal(first.status, 200);
  assert.equal(first.json.version, 1);
  assert.deepEqual((await pull()).json, { ok: true, data: { n: 1 }, savedAt: "2026-10-11T14:05:00.000Z", version: 1, serverTime: clock });
});

test("a pull that names the current version gets no data back", async () => {
  await push({ n: 1 }, { baseVersion: 0 });
  assert.deepEqual((await call("GET", "/api/pull?since=1")).json,
    { ok: true, unchanged: true, savedAt: "2026-10-11T14:05:00.000Z", version: 1, serverTime: clock });
  // Any other version, or nonsense, gets the full copy
  for (const since of ["0", "2", "x", "1.0"]) {
    assert.deepEqual((await call("GET", `/api/pull?since=${since}`)).json.data, { n: 1 }, since);
  }
});

test("pull says the server's time, so clients can correct a clock that is off", async () => {
  clock += 12345;
  assert.equal((await pull()).json.serverTime, clock);
});

test("a push built on an older version is refused with 409 and changes nothing", async () => {
  await push({ device: "A" }, { baseVersion: 0 });
  // B pulled before A pushed, so it still thinks the server is at version 0
  const stale = await push({ device: "B" }, { baseVersion: 0 });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.version, 1);
  assert.deepEqual((await pull()).json.data, { device: "A" });

  // After pulling again, B's push goes through
  const retried = await push({ device: "A+B" }, { baseVersion: 1 });
  assert.equal(retried.status, 200);
  assert.equal(retried.json.version, 2);
});

test("a client that sends no baseVersion is accepted, as before the check existed", async () => {
  await push({ n: 1 }, { baseVersion: 0 });
  const old = await push({ n: 2 });
  assert.equal(old.status, 200);
  assert.equal(old.json.version, 2);
});

test("data written before versions existed counts as version 0", async () => {
  fs.writeFileSync(path.join(dataDir, "sync.json"), JSON.stringify({ data: { old: true }, savedAt: "2026-01-01T00:00:00.000Z" }));
  assert.equal((await pull()).json.version, 0);
  assert.equal((await push({ n: 1 }, { baseVersion: 0 })).json.version, 1);
});
