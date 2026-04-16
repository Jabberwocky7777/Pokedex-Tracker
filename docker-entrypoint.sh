#!/bin/sh
# Startup script for the combined pokedex-tracker container.
# 1. Writes /env.js so the frontend can read SYNC_TOKEN at runtime.
# 2. Starts the sync API server in the background on port 3001.
# 3. Execs nginx in the foreground (PID 1).
set -e

# Write runtime config for the React frontend
mkdir -p /usr/share/nginx/env
printf 'window.__ENV__ = { SYNC_TOKEN: "%s" };\n' "${SYNC_TOKEN:-}" \
  > /usr/share/nginx/env/env.js

# Start the sync server in the background
SYNC_TOKEN="${SYNC_TOKEN:-}" DATA_DIR="/data" node /sync-server/server.js &

# Hand off to nginx (CMD argument)
exec "$@"
