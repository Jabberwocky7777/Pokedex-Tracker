"use strict";

const express               = require("express");
const fs                    = require("fs");
const path                  = require("path");
const { timingSafeEqual, createHash } = require("crypto");

const TOKEN         = process.env.SYNC_TOKEN   || "";
const APP_USER      = process.env.APP_USER     || "";
const APP_PASS      = process.env.APP_PASSWORD || "";
const PORT          = parseInt(process.env.PORT || "3001", 10);
const DATA_DIR      = process.env.DATA_DIR || "/data";
const CORS_ORIGIN   = process.env.CORS_ORIGIN || "";
const DATA_FILE = path.join(DATA_DIR, "sync.json");

if (!TOKEN)             console.warn("[sync] WARNING: SYNC_TOKEN not set — sync is disabled.");
if (!APP_USER || !APP_PASS) console.warn("[sync] WARNING: APP_USER / APP_PASSWORD not set — login disabled.");

// ── Persistence ───────────────────────────────────────────────────────────────

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return null; }
}

function writeData(payload) {
  const tmp = path.join(DATA_DIR, `sync-${Date.now()}.json.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw err;
  }
}

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!TOKEN) return res.status(503).json({ error: "Sync not configured on this server" });
  const auth = (req.headers["authorization"] || "").trim();
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // Constant-time comparison to prevent timing-based token enumeration.
  if (!safeCompare(token, TOKEN)) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── Express ───────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "4mb" }));

// Constant-time string comparison to prevent timing-based credential enumeration.
// Both sides are hashed first, so the buffers always have the same length
// whatever the input (any length, any characters) and nothing is truncated.
function safeCompare(a, b) {
  const digest = (value) => createHash("sha256").update(String(value ?? ""), "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

// Build the set of allowed CORS origins.
// CORS_ORIGIN can be a comma-separated list or a single value.
// capacitor://localhost is always included so the iOS app can connect.
const _configuredOrigins = CORS_ORIGIN
  ? CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : ["http://localhost:5173"];
const _allowedOrigins = new Set([..._configuredOrigins, "capacitor://localhost"]);

app.use((req, res, next) => {
  const requestOrigin = req.headers["origin"] || "";
  // Echo back the matched origin; fall back to the first configured origin.
  const originHeader = _allowedOrigins.has(requestOrigin)
    ? requestOrigin
    : _configuredOrigins[0];
  res.header("Access-Control-Allow-Origin", originHeader);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  // Let cross-origin clients (the iOS app) reuse a preflight instead of sending one per request
  res.header("Access-Control-Max-Age", "600");
  next();
});
app.options("*", (_req, res) => res.status(204).end());

// POST /api/login
app.post("/api/login", (req, res) => {
  if (!APP_USER || !APP_PASS || !TOKEN)
    return res.status(503).json({ error: "Login not configured on this server" });
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string" || !username || !password)
    return res.status(400).json({ error: "Username and password are required" });
  if (!safeCompare(username, APP_USER) || !safeCompare(password, APP_PASS))
    return res.status(401).json({ error: "Invalid username or password" });
  res.json({ ok: true, token: TOKEN });
});

// GET /health
app.get("/health", (_req, res) => res.json({
  ok: true,
  loginEnabled: Boolean(APP_USER && APP_PASS && TOKEN),
  syncEnabled: Boolean(TOKEN),
}));

// GET /api/pull — return saved snapshot
app.get("/api/pull", requireAuth, (_req, res) => {
  const saved = readData();
  if (!saved) return res.json({ ok: true, data: null, savedAt: null });
  res.json({ ok: true, data: saved.data, savedAt: saved.savedAt });
});

// POST /api/push — save new snapshot
app.post("/api/push", requireAuth, (req, res) => {
  const { data } = req.body ?? {};
  if (!data || typeof data !== "object" || Array.isArray(data))
    return res.status(400).json({ error: "Missing or invalid data payload" });
  const savedAt = new Date().toISOString();
  try {
    writeData({ data, savedAt });
  } catch (err) {
    console.error("[sync] Failed to write data:", err);
    return res.status(500).json({ error: "Failed to save data" });
  }
  res.json({ ok: true, savedAt });
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

app.listen(PORT, () => console.log(`[sync] Listening on :${PORT}`));
