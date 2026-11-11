"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const { timingSafeEqual, createHash, randomBytes } = require("crypto");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Snapshots: one per hour for the last day, then one per day for 30 days
const HOURLY_SNAPSHOTS_FOR = DAY_MS;
const DAILY_SNAPSHOTS_FOR = 30 * DAY_MS;
// An hourly snapshot's id is the UTC hour it was taken in, e.g. "2026-10-11T14"
const HOURLY_ID = /^\d{4}-\d{2}-\d{2}T\d{2}$/;
// Besides the hourly ones, the copies replaced by the last few pushes are kept,
// so a bad push can be undone to just before it rather than to the start of the
// hour. Their id is the UTC time of the push to the millisecond, e.g.
// "2026-10-11T14-05-07-123" (no colons: the folder may be on Windows in dev).
const RECENT_ID = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}$/;
const RECENT_SNAPSHOTS = 10;
const isSnapshotId = (id) => HOURLY_ID.test(id) || RECENT_ID.test(id);

// The values .env.example ships with. A copied .env that still has them would
// give a working login with published credentials, so they count as unset.
const PLACEHOLDERS = {
  token: "replace-with-your-secret-token",
  user: "replace-with-your-username",
  password: "replace-with-a-strong-password",
};
const ENV_NAMES = { token: "SYNC_TOKEN", user: "APP_USER", password: "APP_PASSWORD" };

/** The settings that are still their .env.example placeholder, by env name */
function placeholderSettings(config) {
  return Object.keys(PLACEHOLDERS)
    .filter((key) => config[key] === PLACEHOLDERS[key])
    .map((key) => ENV_NAMES[key]);
}

/** Warnings for a configuration that is missing, a placeholder, or weak (logged at start) */
function configWarnings(config) {
  const warnings = [];
  for (const name of placeholderSettings(config))
    warnings.push(`${name} is still the .env.example placeholder, so it is treated as not set.`);
  const real = (key) => (config[key] && config[key] !== PLACEHOLDERS[key] ? config[key] : "");
  const token = real("token");
  const password = real("password");
  if (!token) warnings.push("SYNC_TOKEN not set: sync is disabled.");
  else if (token.length < 32)
    warnings.push("SYNC_TOKEN is shorter than 32 characters. Generate one with: openssl rand -hex 32");
  if (!real("user") || !password) warnings.push("APP_USER / APP_PASSWORD not set: login is disabled.");
  else if (password.length < 12) warnings.push("APP_PASSWORD is shorter than 12 characters.");
  return warnings;
}

// Failed logins, counted across every client (nginx's limit is per address,
// and an attacker with many addresses is not slowed by it). After LOCK_AFTER
// failures within LOCK_WINDOW, logins are refused for 30 s, then 60 s, and so
// on up to 15 minutes while failures keep coming. A successful login clears it.
// The cost: someone can keep sign-in locked for the owner. Devices already
// signed in keep syncing, since their token is checked separately.
const LOCK_AFTER = 10;
const LOCK_WINDOW = 10 * 60 * 1000;
const LOCK_FIRST = 30 * 1000;
const LOCK_MAX = 15 * 60 * 1000;

function createLoginLimiter(now) {
  let failures = [];
  let lockUntil = 0;
  let level = 0;
  return {
    /** Seconds to wait, or 0 when a login may be tried */
    retryAfter() {
      const left = lockUntil - now();
      return left > 0 ? Math.ceil(left / 1000) : 0;
    },
    failed() {
      const t = now();
      failures = failures.filter((at) => t - at < LOCK_WINDOW);
      if (failures.length === 0) level = 0;
      failures.push(t);
      if (failures.length > LOCK_AFTER * 4) failures = failures.slice(-LOCK_AFTER * 4);
      if (failures.length >= LOCK_AFTER) {
        lockUntil = t + Math.min(LOCK_FIRST * 2 ** level, LOCK_MAX);
        level++;
      }
    },
    succeeded() {
      failures = [];
      lockUntil = 0;
      level = 0;
    },
  };
}

// Constant-time string comparison to prevent timing-based credential enumeration.
// Both sides are hashed first, so the buffers always have the same length
// whatever the input (any length, any characters) and nothing is truncated.
function safeCompare(a, b) {
  const digest = (value) =>
    createHash("sha256")
      .update(String(value ?? ""), "utf8")
      .digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Builds the Express app. Everything it needs comes in through `config`, so
 * the tests can run it against a temporary directory and a fake clock.
 */
function createApp(config = {}) {
  const { dataDir = "/data", corsOrigin = "", now = Date.now } = config;
  // A setting left at its .env.example placeholder counts as not set
  const placeholders = placeholderSettings(config);
  const unlessPlaceholder = (key) => (config[key] && config[key] !== PLACEHOLDERS[key] ? config[key] : "");
  const token = unlessPlaceholder("token");
  const user = unlessPlaceholder("user");
  const password = unlessPlaceholder("password");
  const dataFile = path.join(dataDir, "sync.json");
  const snapshotDir = path.join(dataDir, "snapshots");
  const sessionsFile = path.join(dataDir, "sessions.json");
  const limiter = createLoginLimiter(now);

  // ── Persistence ─────────────────────────────────────────────────────────────

  function readData() {
    try {
      return JSON.parse(fs.readFileSync(dataFile, "utf8"));
    } catch {
      return null;
    }
  }

  // The current version and savedAt, kept in memory so a poll that finds
  // nothing new (?since=) doesn't read and parse the whole file. Loaded on first
  // use and set on every write; the file is only read when its data is sent.
  let meta = null;
  function currentMeta() {
    if (!meta) {
      const saved = readData();
      meta = saved
        ? { exists: true, version: saved.version ?? 0, savedAt: saved.savedAt ?? null }
        : { exists: false, version: 0, savedAt: null };
    }
    return meta;
  }

  function writeData(payload) {
    const tmp = path.join(dataDir, `sync-${now()}.json.tmp`);
    try {
      // A bind mount can point at a folder that doesn't exist yet
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
      fs.renameSync(tmp, dataFile);
      meta = { exists: true, version: payload.version, savedAt: payload.savedAt };
    } catch (err) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
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
  // Either kind of id as a time, for ordering the list
  const snapshotTimeOf = (id) =>
    RECENT_ID.test(id)
      ? Date.parse(`${id.slice(0, 13)}:${id.slice(14, 16)}:${id.slice(17, 19)}.${id.slice(20)}Z`)
      : snapshotTime(id);

  function snapshotIds() {
    try {
      return fs
        .readdirSync(snapshotDir)
        .filter((name) => name.endsWith(".json") && isSnapshotId(name.slice(0, -5)))
        .map((name) => name.slice(0, -5))
        .sort();
    } catch {
      return [];
    }
  }

  function pruneSnapshots() {
    const ids = snapshotIds();
    // Recent ones: the newest RECENT_SNAPSHOTS, whatever their age
    const recent = ids.filter((id) => RECENT_ID.test(id));
    for (const id of recent.slice(0, Math.max(0, recent.length - RECENT_SNAPSHOTS))) {
      try {
        fs.unlinkSync(snapshotFile(id));
      } catch {
        /* ignore */
      }
    }
    const keptDays = new Set();
    for (const id of ids.filter((id) => HOURLY_ID.test(id))) {
      // oldest first, so the first one seen for a day is that day's
      const age = now() - snapshotTime(id);
      if (age <= HOURLY_SNAPSHOTS_FOR) continue;
      const day = id.slice(0, 10);
      if (age <= DAILY_SNAPSHOTS_FOR && !keptDays.has(day)) {
        keptDays.add(day);
        continue;
      }
      try {
        fs.unlinkSync(snapshotFile(id));
      } catch {
        /* ignore */
      }
    }
  }

  function keepSnapshot() {
    try {
      if (!fs.existsSync(dataFile)) return;
      fs.mkdirSync(snapshotDir, { recursive: true });
      const iso = new Date(now()).toISOString(); // 2026-10-11T14:05:07.123Z
      const hourly = iso.slice(0, 13);
      if (!fs.existsSync(snapshotFile(hourly))) fs.copyFileSync(dataFile, snapshotFile(hourly));
      fs.copyFileSync(dataFile, snapshotFile(iso.slice(0, 23).replace(/[:.]/g, "-")));
      pruneSnapshots();
    } catch (err) {
      // A snapshot that can't be written must not stop the push itself
      console.error("[sync] Failed to keep a snapshot:", err);
    }
  }

  function readSnapshot(id) {
    try {
      return JSON.parse(fs.readFileSync(snapshotFile(id), "utf8"));
    } catch {
      return null;
    }
  }

  // A snapshot file is `{"data":…,"savedAt":"…","version":n}` (writeData), so
  // its savedAt is in the last few bytes: listing reads those instead of
  // parsing every copy. Anything unexpected falls back to a full read.
  const SAVED_AT_TAIL = /"savedAt":(null|"[^"\\]*")(?:,"version":\d+)?\}\s*$/;
  function readSavedAt(id) {
    let fd;
    try {
      fd = fs.openSync(snapshotFile(id), "r");
      const size = fs.fstatSync(fd).size;
      const length = Math.min(size, 256);
      const tail = Buffer.alloc(length);
      fs.readSync(fd, tail, 0, length, size - length);
      const match = SAVED_AT_TAIL.exec(tail.toString("utf8"));
      if (match) return JSON.parse(match[1]);
    } catch {
      // fall through to the full read
    } finally {
      if (fd !== undefined)
        try {
          fs.closeSync(fd);
        } catch {
          /* ignore */
        }
    }
    return readSnapshot(id)?.savedAt ?? null;
  }

  // ── Device sessions ─────────────────────────────────────────────────────────
  // Each login mints its own random token; only its SHA-256 is stored, in
  // DATA_DIR/sessions.json, with a label and when it was last used, so one
  // device can be signed out on its own. Sessions belong to the current
  // SYNC_TOKEN (`key`), so changing SYNC_TOKEN still signs every device out.
  // SYNC_TOKEN itself is still accepted, for devices signed in before sessions.

  const hash = (value) => createHash("sha256").update(String(value), "utf8").digest("hex");
  const tokenKey = token ? hash(`session-key:${token}`).slice(0, 16) : "";
  const USED_EVERY = HOUR_MS; // lastUsedAt is written at most once an hour per session
  let sessions = null;

  function loadSessions() {
    if (sessions) return sessions;
    try {
      const parsed = JSON.parse(fs.readFileSync(sessionsFile, "utf8"));
      sessions = Array.isArray(parsed?.sessions) ? parsed.sessions.filter((s) => s && s.key === tokenKey) : [];
    } catch {
      sessions = [];
    }
    return sessions;
  }

  function saveSessions() {
    const tmp = path.join(dataDir, `sessions-${now()}.json.tmp`);
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify({ sessions }), "utf8");
      fs.renameSync(tmp, sessionsFile);
    } catch (err) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      console.error("[sync] Failed to write sessions:", err);
    }
  }

  function createSession(label) {
    const secret = randomBytes(32).toString("hex");
    const at = new Date(now()).toISOString();
    const session = {
      id: randomBytes(8).toString("hex"),
      hash: hash(secret),
      key: tokenKey,
      label: typeof label === "string" && label.trim() ? label.trim().slice(0, 80) : "Unnamed device",
      createdAt: at,
      lastUsedAt: at,
    };
    loadSessions().push(session);
    saveSessions();
    return { session, secret };
  }

  function removeSession(id) {
    const before = loadSessions().length;
    sessions = loadSessions().filter((s) => s.id !== id);
    if (sessions.length === before) return false;
    saveSessions();
    return true;
  }

  // ── Auth middleware ─────────────────────────────────────────────────────────

  function requireAuth(req, res, next) {
    if (!token) return res.status(503).json({ error: "Sync not configured on this server" });
    const auth = (req.headers["authorization"] || "").trim();
    const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    // Constant-time comparison to prevent timing-based token enumeration.
    if (given && safeCompare(given, token)) {
      req.sessionId = null;
      return next();
    }
    // A session token is 256 random bits, looked up by its hash
    const digest = given ? hash(given) : "";
    const session = digest ? loadSessions().find((s) => s.hash === digest) : undefined;
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (now() - Date.parse(session.lastUsedAt) > USED_EVERY) {
      session.lastUsedAt = new Date(now()).toISOString();
      saveSessions();
    }
    req.sessionId = session.id;
    next();
  }

  // ── Express ─────────────────────────────────────────────────────────────────

  const app = express();
  app.disable("x-powered-by");
  // Exact paths only. nginx rate-limits login by its exact path, so a path
  // Express would also accept ("/api/Login", "/api/login/") must not reach it
  // by way of the looser /api/ limit.
  app.set("case sensitive routing", true);
  app.set("strict routing", true);
  // No client sends compressed bodies; refusing them (415) leaves out a whole
  // class of decompression bugs, like the body-parser advisory of October 2026
  app.use(express.json({ limit: "4mb", inflate: false }));

  // Origins allowed to call the API from another site: CORS_ORIGIN (a
  // comma-separated list) plus capacitor://localhost, the iOS app. The web app
  // is same-origin (nginx in production, Vite's proxy in dev) and needs none.
  const allowedOrigins = new Set([
    ...corsOrigin
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    "capacitor://localhost",
  ]);

  // A pull carries all of the user's data: no API answer may be cached
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/health") res.header("Cache-Control", "no-store");
    next();
  });

  app.use((req, res, next) => {
    const requestOrigin = req.headers["origin"] || "";
    // Only an allowed origin is echoed back; anything else gets no CORS header
    if (allowedOrigins.has(requestOrigin)) res.header("Access-Control-Allow-Origin", requestOrigin);
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
    if (!user || !password || !token) return res.status(503).json({ error: "Login not configured on this server" });
    const wait = limiter.retryAfter();
    if (wait > 0) {
      res.header("Retry-After", String(wait));
      return res.status(429).json({ error: "Too many failed sign-ins. Try again later.", retryAfter: wait });
    }
    const { username, password: given, label } = req.body ?? {};
    if (typeof username !== "string" || typeof given !== "string" || !username || !given)
      return res.status(400).json({ error: "Username and password are required" });
    if (!safeCompare(username, user) || !safeCompare(given, password)) {
      limiter.failed();
      return res.status(401).json({ error: "Invalid username or password" });
    }
    limiter.succeeded();
    const { session, secret } = createSession(label);
    res.json({ ok: true, token: secret, sessionId: session.id });
  });

  // POST /api/logout: ends this device's session (SYNC_TOKEN itself can't be ended)
  app.post("/api/logout", requireAuth, (req, res) => {
    if (req.sessionId) removeSession(req.sessionId);
    res.json({ ok: true });
  });

  // GET /api/sessions: the signed-in devices, most recently used first
  app.get("/api/sessions", requireAuth, (req, res) => {
    const list = [...loadSessions()]
      .sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt))
      .map((s) => ({
        id: s.id,
        label: s.label,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        current: s.id === req.sessionId,
      }));
    res.json({ ok: true, sessions: list, legacyToken: req.sessionId === null });
  });

  // POST /api/sessions/:id/revoke: sign one device out
  app.post("/api/sessions/:id/revoke", requireAuth, (req, res) => {
    const { id } = req.params;
    if (!/^[0-9a-f]{16}$/.test(id) || !removeSession(id)) return res.status(404).json({ error: "No such session" });
    res.json({ ok: true });
  });

  // GET /health
  app.get("/health", (_req, res) =>
    res.json({
      ok: true,
      loginEnabled: Boolean(user && password && token),
      syncEnabled: Boolean(token),
      // Settings still at their .env.example value (treated as not set)
      ...(placeholders.length ? { placeholders } : {}),
    }),
  );

  // GET /api/pull — return saved snapshot
  // `version` counts pushes. A client sends it back with its next push, so the
  // server can tell whether that push was built on the copy it has now.
  // `?since=<version>`: when that is still the current version the data is left
  // out ({ unchanged: true }), so a poll that finds nothing new costs a few bytes.
  // `serverTime` lets clients correct for a device clock that is off, since the
  // merge compares timestamps written on different devices.
  app.get("/api/pull", requireAuth, (req, res) => {
    const serverTime = now();
    const { exists, version, savedAt } = currentMeta();
    const since = typeof req.query.since === "string" && /^\d+$/.test(req.query.since) ? Number(req.query.since) : null;
    if (exists && since === version) return res.json({ ok: true, unchanged: true, savedAt, version, serverTime });
    const saved = exists ? readData() : null;
    if (!saved) return res.json({ ok: true, data: null, savedAt: null, version: 0, serverTime });
    res.json({ ok: true, data: saved.data, savedAt: saved.savedAt, version: saved.version ?? 0, serverTime });
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
    const { version } = currentMeta();
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
    // savedAt is when that copy was pushed (the id is when it was replaced).
    // The first push of an hour keeps the same copy twice, hourly and recent:
    // it is listed once, under the hourly id (which outlives the recent ones).
    const all = snapshotIds().map((id) => ({ id, savedAt: readSavedAt(id) }));
    const hourlySavedAt = new Set(all.filter((s) => HOURLY_ID.test(s.id) && s.savedAt).map((s) => s.savedAt));
    const snapshots = all
      .filter((s) => HOURLY_ID.test(s.id) || !hourlySavedAt.has(s.savedAt))
      .sort((a, b) => snapshotTimeOf(b.id) - snapshotTimeOf(a.id));
    res.json({ ok: true, snapshots });
  });

  // GET /api/snapshots/:id — one older copy, in the same shape as /api/pull
  app.get("/api/snapshots/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const saved = isSnapshotId(id) ? readSnapshot(id) : null;
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

module.exports = { createApp, configWarnings, PLACEHOLDERS };

if (require.main === module) {
  const config = {
    token: process.env.SYNC_TOKEN || "",
    user: process.env.APP_USER || "",
    password: process.env.APP_PASSWORD || "",
    dataDir: process.env.DATA_DIR || "/data",
    corsOrigin: process.env.CORS_ORIGIN || "",
  };
  const port = parseInt(process.env.PORT || "3001", 10);
  // Loopback only: in the image nginx is the way in, with the rate limits.
  // HOST=0.0.0.0 exposes it on every interface.
  const host = process.env.HOST || "127.0.0.1";

  for (const warning of configWarnings(config)) console.warn(`[sync] WARNING: ${warning}`);

  createApp(config).listen(port, host, () => console.log(`[sync] Listening on ${host}:${port}`));
}
