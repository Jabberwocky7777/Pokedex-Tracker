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

test("a push keeps the copy it replaces, once per hour", async () => {
  await push({ n: 1 });
  assert.deepEqual((await call("GET", "/api/snapshots")).json.snapshots, [], "nothing to keep before the first push");

  clock += 10 * 60 * 1000;
  await push({ n: 2 });
  clock += 10 * 60 * 1000;
  await push({ n: 3 });

  const list = (await call("GET", "/api/snapshots")).json.snapshots;
  assert.equal(list.length, 1);
  assert.equal(list[0].id, "2026-10-11T14");
  assert.equal(list[0].savedAt, "2026-10-11T14:05:00.000Z");

  const snapshot = await call("GET", `/api/snapshots/${list[0].id}`);
  assert.equal(snapshot.status, 200);
  assert.deepEqual(snapshot.json.data, { n: 1 });

  clock += HOUR;
  await push({ n: 4 });
  const later = (await call("GET", "/api/snapshots")).json.snapshots;
  assert.deepEqual(later.map((s) => s.id), ["2026-10-11T15", "2026-10-11T14"]);
  assert.deepEqual((await call("GET", "/api/snapshots/2026-10-11T15")).json.data, { n: 3 });
  assert.deepEqual((await pull()).json.data, { n: 4 });
});

test("old snapshots are thinned to one a day, and dropped after 30 days", async () => {
  await push({ n: 0 });
  // A push every hour for 40 days
  for (let i = 1; i <= 40 * 24; i++) {
    clock += HOUR;
    await push({ n: i });
  }
  const ids = (await call("GET", "/api/snapshots")).json.snapshots.map((s) => s.id);
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
