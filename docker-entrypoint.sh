#!/bin/sh
# Startup script for the combined pokedex-tracker container.
# 1. Starts the sync API server in the background on port 3001, and starts it
#    again if it ever exits (nginx is PID 1, so Docker's restart policy would
#    not notice the sync server dying on its own).
# 2. Execs nginx in the foreground (PID 1).
#
# Auth is handled in the React app (custom login screen) — no nginx Basic Auth.
# The SYNC_TOKEN is stored in the user's browser localStorage after first login.
set -e

# ── Sync server ────────────────────────────────────────────────────────────────
(
  while true; do
    SYNC_TOKEN="${SYNC_TOKEN:-}" DATA_DIR="/data" node /sync-server/server.js || true
    echo "[entrypoint] sync server exited — restarting in 2s" >&2
    sleep 2
  done
) &

# ── Hand off to nginx (CMD argument) ──────────────────────────────────────────
exec "$@"
