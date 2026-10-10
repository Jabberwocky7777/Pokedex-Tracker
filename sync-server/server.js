"use strict";

const express               = require("express");
const fs                    = require("fs");
const path                  = require("path");
const { timingSafeEqual }   = require("crypto");

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
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a ?? "").padEnd(128, "\0").slice(0, 128));
  const bufB = Buffer.from(String(b ?? "").padEnd(128, "\0").slice(0, 128));
  return timingSafeEqual(bufA, bufB);
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
  next();
});
app.options("*", (_req, res) => res.status(204).end());

// POST /api/login
app.post("/api/login", (req, res) => {
  if (!APP_USER || !APP_PASS || !TOKEN)
    return res.status(503).json({ error: "Login not configured on this server" });
  const { username, password } = req.body ?? {};
  if (!username || !password)
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
  if (!data || typeof data !== "object")
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

app.listen(PORT, () => console.log(`[sync] Listening on :${PORT}`));
