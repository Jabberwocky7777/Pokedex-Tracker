"use strict";

const express = require("express");
const fs      = require("fs");
const path    = require("path");

const TOKEN    = process.env.SYNC_TOKEN || "";
const PORT     = parseInt(process.env.PORT || "3001", 10);
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "sync.json");

// Fail hard if no token — running without auth would accept any request.
if (!TOKEN) {
  console.error("[sync] FATAL: SYNC_TOKEN is not set. Refusing to start.");
  process.exit(1);
}

// ── Persistence helpers ───────────────────────────────────────────────────────
// Writes are atomic: write to a temp file in the same directory, then rename.
// Temp file must be on the same filesystem as the target so renameSync is
// atomic (cross-device rename fails with EXDEV on mounted host-path volumes).

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return null; // file doesn't exist yet, or is unreadable — that's fine
  }
}

function writeData(payload) {
  const tmp = path.join(DATA_DIR, `sync-${Date.now()}.json.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    // Clean up orphaned temp file so it doesn't accumulate on disk
    try { fs.unlinkSync(tmp); } catch { /* ignore — may not exist if writeFileSync failed */ }
    throw err; // re-throw so the route handler returns 500
  }
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();

// CORS — the frontend calls /api/* via nginx proxy (same-origin), so these
// headers are never needed for browser requests. They're kept here solely in
// case someone runs the sync server standalone (e.g. during local development
// without the nginx proxy). Security is enforced by the Bearer token, not origin.
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});
app.options("*", (_req, res) => res.status(204).end());

app.use(express.json({ limit: "4mb" })); // real payloads are ~50 KB; generous limit

// Auth middleware
function requireToken(req, res, next) {
  const auth = req.headers["authorization"] || "";
  if (auth !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// GET /api/sync → return current snapshot (204 if nothing saved yet)
app.get("/api/sync", requireToken, (_req, res) => {
  const saved = readData();
  if (!saved) return res.status(204).end();
  res.json(saved);
});

// POST /api/sync → replace snapshot (last-write-wins)
app.post("/api/sync", requireToken, (req, res) => {
  const { data } = req.body ?? {};
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Missing or invalid data payload" });
  }
  const savedAt = new Date().toISOString();
  try {
    writeData({ data, savedAt });
  } catch (err) {
    console.error("[sync] Failed to write data:", err);
    return res.status(500).json({ error: "Failed to save data" });
  }
  res.json({ ok: true, savedAt });
});

// GET /health → no auth, for TrueNAS container health checks
app.get("/health", (_req, res) => res.json({ ok: true }));

// Ensure data directory exists before we try to write to it
fs.mkdirSync(DATA_DIR, { recursive: true });

app.listen(PORT, () => {
  console.log(`[sync] listening on :${PORT}`);
  console.log(`[sync] data file: ${DATA_FILE}`);
  console.log(`[sync] auth: enabled`);
});
