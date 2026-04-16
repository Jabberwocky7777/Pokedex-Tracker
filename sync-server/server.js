"use strict";

const express = require("express");
const fs      = require("fs");
const path    = require("path");
const os      = require("os");

const TOKEN    = process.env.SYNC_TOKEN || "";
const PORT     = parseInt(process.env.PORT || "3001", 10);
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "sync.json");

if (!TOKEN) {
  console.warn("[sync] WARNING: SYNC_TOKEN is not set — all /api/ requests will be rejected.");
}

// ── Persistence helpers ───────────────────────────────────────────────────────
// Writes are atomic: write to a temp file then rename, so a mid-write crash
// never leaves a corrupt data file.

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return null; // file doesn't exist yet, or is unreadable — that's fine
  }
}

function writeData(payload) {
  const tmp = path.join(os.tmpdir(), `sync-${Date.now()}.json.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "4mb" })); // real payloads are ~50 KB; generous limit

// Auth middleware
function requireToken(req, res, next) {
  const auth = req.headers["authorization"] || "";
  if (!TOKEN || auth !== `Bearer ${TOKEN}`) {
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
  writeData({ data, savedAt });
  res.json({ ok: true, savedAt });
});

// GET /health → no auth, for TrueNAS container health checks
app.get("/health", (_req, res) => res.json({ ok: true }));

// Ensure data directory exists before we try to write to it
fs.mkdirSync(DATA_DIR, { recursive: true });

app.listen(PORT, () => {
  console.log(`[sync] listening on :${PORT}`);
  console.log(`[sync] data file: ${DATA_FILE}`);
  console.log(`[sync] auth: ${TOKEN ? "enabled" : "DISABLED (no token set)"}`);
});
