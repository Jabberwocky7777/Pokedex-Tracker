"use strict";

const express               = require("express");
const fs                    = require("fs");
const path                  = require("path");
const { timingSafeEqual, createHash } = require("crypto");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * HOUR_MS;
// Snapshots: one per hour for the last day, then one per day for 30 days
const HOURLY_SNAPSHOTS_FOR = DAY_MS;
const DAILY_SNAPSHOTS_FOR  = 30 * DAY_MS;
// A snapshot's id is the UTC hour it was taken in, e.g. "2026-10-11T14"
const SNAPSHOT_ID = /^\d{4}-\d{2}-\d{2}T\d{2}$/;

// Constant-time string comparison to prevent timing-based credential enumeration.
// Both sides are hashed first, so the buffers always have the same length
// whatever the input (any length, any characters) and nothing is truncated.
function safeCompare(a, b) {
  const digest = (value) => createHash("sha256").update(String(value ?? ""), "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Builds the Express app. Everything it needs comes in through `config`, so
 * the tests can run it against a temporary directory and a fake clock.
 */
function createApp({ token = "", user = "", password = "", dataDir = "/data", corsOrigin = "", now = Date.now } = {}) {
  const dataFile    = path.join(dataDir, "sync.json");
  const snapshotDir = path.join(dataDir, "snapshots");

  // ── Persistence ─────────────────────────────────────────────────────────────

  function readData() {
    try { return JSON.parse(fs.readFileSync(dataFile, "utf8")); }
    catch { return null; }
  }

  function writeData(payload) {
    const tmp = path.join(dataDir, `sync-${now()}.json.tmp`);
    try {
      // A bind mount can point at a folder that doesn't exist yet
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
      fs.renameSync(tmp, dataFile);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      throw err;
    }
  }

  // ── Snapshots ───────────────────────────────────────────────────────────────
  // Before a push replaces sync.json, the copy it replaces is kept — once per
  // hour, so a bad push (a client bug, a "clear" someone regrets) can be taken
  // back from Settings. The server only stores and returns them; restoring is
  // the client pushing a snapshot's contents like any other change.

  const snapshotFile = (id) => path.join(snapshotDir, `${id}.json`);
  const snapshotTime = (id) => Date.parse(`${id}:00:00.000Z`);

  function snapshotIds() {
    try {
      return fs.readdirSync(snapshotDir)
        .filter((name) => name.endsWith(".json") && SNAPSHOT_ID.test(name.slice(0, -5)))
        .map((name) => name.slice(0, -5))
        .sort();
    } catch { return []; }
  }

  function pruneSnapshots() {
    const keptDays = new Set();
    for (const id of snapshotIds()) { // oldest first, so the first one seen for a day is that day's
      const age = now() - snapshotTime(id);
      if (age <= HOURLY_SNAPSHOTS_FOR) continue;
      const day = id.slice(0, 10);
      if (age <= DAILY_SNAPSHOTS_FOR && !keptDays.has(day)) { keptDays.add(day); continue; }
      try { fs.unlinkSync(snapshotFile(id)); } catch { /* ignore */ }
    }
  }

  function keepSnapshot() {
    try {
      const id = new Date(now()).toISOString().slice(0, 13);
      if (fs.existsSync(snapshotFile(id)) || !fs.existsSync(dataFile)) return;
      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.copyFileSync(dataFile, snapshotFile(id));
      pruneSnapshots();
    } catch (err) {
      // A snapshot that can't be written must not stop the push itself
      console.error("[sync] Failed to keep a snapshot:", err);
    }
  }

  function readSnapshot(id) {
    try { return JSON.parse(fs.readFileSync(snapshotFile(id), "utf8")); }
    catch { return null; }
  }

  // ── Auth middleware ─────────────────────────────────────────────────────────

  function requireAuth(req, res, next) {
    if (!token) return res.status(503).json({ error: "Sync not configured on this server" });
    const auth = (req.headers["authorization"] || "").trim();
    const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    // Constant-time comparison to prevent timing-based token enumeration.
    if (!safeCompare(given, token)) return res.status(401).json({ error: "Unauthorized" });
    next();
  }

  // ── Express ─────────────────────────────────────────────────────────────────

  const app = express();
  // Exact paths only. nginx rate-limits login by its exact path, so a path
  // Express would also accept ("/api/Login", "/api/login/") must not reach it
  // by way of the looser /api/ limit.
  app.set("case sensitive routing", true);
  app.set("strict routing", true);
  app.use(express.json({ limit: "4mb" }));

  // Build the set of allowed CORS origins.
  // CORS_ORIGIN can be a comma-separated list or a single value.
  // capacitor://localhost is always included so the iOS app can connect.
  const configuredOrigins = corsOrigin
    ? corsOrigin.split(",").map((s) => s.trim()).filter(Boolean)
    : ["http://localhost:5173"];
  const allowedOrigins = new Set([...configuredOrigins, "capacitor://localhost"]);

  app.use((req, res, next) => {
    const requestOrigin = req.headers["origin"] || "";
    // Echo back the matched origin; fall back to the first configured origin.
    const originHeader = allowedOrigins.has(requestOrigin)
      ? requestOrigin
      : configuredOrigins[0];
    res.header("Access-Control-Allow-Origin", originHeader);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    // Let cross-origin clients (the iOS app) reuse a preflight instead of sending one per request
    res.header("Access-Control-Max-Age", "600");
    next();
  });
  // Every preflight gets an empty 204 (Express 5 path syntax: "/{*splat}" is any path)
  app.options("/{*splat}", (_req, res) => res.status(204).end());

  // POST /api/login
  app.post("/api/login", (req, res) => {
    if (!user || !password || !token)
      return res.status(503).json({ error: "Login not configured on this server" });
    const { username, password: given } = req.body ?? {};
    if (typeof username !== "string" || typeof given !== "string" || !username || !given)
      return res.status(400).json({ error: "Username and password are required" });
    if (!safeCompare(username, user) || !safeCompare(given, password))
      return res.status(401).json({ error: "Invalid username or password" });
    res.json({ ok: true, token });
  });

  // GET /health
  app.get("/health", (_req, res) => res.json({
    ok: true,
    loginEnabled: Boolean(user && password && token),
    syncEnabled: Boolean(token),
  }));

  // GET /api/pull — return saved snapshot
  // `version` counts pushes. A client sends it back with its next push, so the
  // server can tell whether that push was built on the copy it has now.
  app.get("/api/pull", requireAuth, (_req, res) => {
    const saved = readData();
    if (!saved) return res.json({ ok: true, data: null, savedAt: null, version: 0 });
    res.json({ ok: true, data: saved.data, savedAt: saved.savedAt, version: saved.version ?? 0 });
  });

  // POST /api/push — save new snapshot
  app.post("/api/push", requireAuth, (req, res) => {
    const { data, baseVersion } = req.body ?? {};
    if (!data || typeof data !== "object" || Array.isArray(data))
      return res.status(400).json({ error: "Missing or invalid data payload" });
    if (baseVersion !== undefined && baseVersion !== null && !Number.isInteger(baseVersion))
      return res.status(400).json({ error: "Invalid baseVersion" });
    // Another device pushed since this client pulled: refuse, so the client
    // pulls and merges again instead of replacing that push. (Read, compare and
    // write are synchronous, so two pushes can't both pass.) Clients from before
    // the version check send no baseVersion and are accepted as before.
    const version = readData()?.version ?? 0;
    if (Number.isInteger(baseVersion) && baseVersion !== version)
      return res.status(409).json({ error: "The server has a newer copy — pull and merge first", version });
    const savedAt = new Date(now()).toISOString();
    keepSnapshot();
    try {
      writeData({ data, savedAt, version: version + 1 });
    } catch (err) {
      console.error("[sync] Failed to write data:", err);
      return res.status(500).json({ error: "Failed to save data" });
    }
    res.json({ ok: true, savedAt, version: version + 1 });
  });

  // GET /api/snapshots — the older copies that are kept, newest first
  app.get("/api/snapshots", requireAuth, (_req, res) => {
    const snapshots = snapshotIds().reverse().map((id) => {
      // savedAt is when that copy was pushed (the id is the hour it was replaced in)
      return { id, savedAt: readSnapshot(id)?.savedAt ?? null };
    });
    res.json({ ok: true, snapshots });
  });

  // GET /api/snapshots/:id — one older copy, in the same shape as /api/pull
  app.get("/api/snapshots/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const saved = SNAPSHOT_ID.test(id) ? readSnapshot(id) : null;
    if (!saved) return res.status(404).json({ error: "No such snapshot" });
    res.json({ ok: true, id, data: saved.data, savedAt: saved.savedAt ?? null });
  });

  // Anything unknown is a JSON 404, and errors (malformed JSON, body too large,
  // bugs) are a JSON message — never Express's HTML page with a stack trace.
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  // (Express recognises an error handler by its four parameters)
  app.use((err, _req, res, _next) => {
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error("[sync] Unhandled error:", err);
    const message = status === 413 ? "Payload too large" : status === 500 ? "Server error" : "Bad request";
    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = { createApp };

if (require.main === module) {
  const config = {
    token:      process.env.SYNC_TOKEN   || "",
    user:       process.env.APP_USER     || "",
    password:   process.env.APP_PASSWORD || "",
    dataDir:    process.env.DATA_DIR     || "/data",
    corsOrigin: process.env.CORS_ORIGIN  || "",
  };
  const port = parseInt(process.env.PORT || "3001", 10);

  if (!config.token)                    console.warn("[sync] WARNING: SYNC_TOKEN not set — sync is disabled.");
  if (!config.user || !config.password) console.warn("[sync] WARNING: APP_USER / APP_PASSWORD not set — login disabled.");

  createApp(config).listen(port, () => console.log(`[sync] Listening on :${port}`));
}
