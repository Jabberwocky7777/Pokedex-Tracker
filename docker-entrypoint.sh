#!/bin/sh
# Startup script for the combined pokedex-tracker container.
# 1. Starts the sync API server in the background on port 3001.
# 2. Execs nginx in the foreground (PID 1).
#
# Auth is handled in the React app (custom login screen) — no nginx Basic Auth.
# The SYNC_TOKEN is stored in the user's browser localStorage after first login.
set -e

# ── Sync server ────────────────────────────────────────────────────────────────
SYNC_TOKEN="${SYNC_TOKEN:-}" DATA_DIR="/data" node /sync-server/server.js &

# ── Hand off to nginx (CMD argument) ──────────────────────────────────────────
exec "$@"
