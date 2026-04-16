#!/bin/sh
# Startup script for the combined pokedex-tracker container.
# 1. Generates /etc/nginx/.htpasswd from NGINX_USER + NGINX_PASSWORD (Basic Auth).
# 2. Writes /env.js so the frontend can read SYNC_TOKEN at runtime.
# 3. Starts the sync API server in the background on port 3001.
# 4. Execs nginx in the foreground (PID 1).
set -e

# ── Basic Auth ─────────────────────────────────────────────────────────────────
# Generate .htpasswd from env vars. Both NGINX_USER and NGINX_PASSWORD must be
# set or the container will refuse to start (prevents accidentally open deploys).
if [ -z "${NGINX_USER}" ] || [ -z "${NGINX_PASSWORD}" ]; then
  echo "[entrypoint] FATAL: NGINX_USER and NGINX_PASSWORD must both be set." >&2
  exit 1
fi
htpasswd -bc /etc/nginx/.htpasswd "${NGINX_USER}" "${NGINX_PASSWORD}"
echo "[entrypoint] Basic Auth configured for user: ${NGINX_USER}"

# ── Runtime config (env.js) ────────────────────────────────────────────────────
# Use Node + JSON.stringify so any characters in SYNC_TOKEN are safely escaped.
# printf with %s would break if the token contained quotes or backslashes.
mkdir -p /usr/share/nginx/env
node -e "
  var fs = require('fs');
  var env = { SYNC_TOKEN: process.env.SYNC_TOKEN || '' };
  fs.writeFileSync('/usr/share/nginx/env/env.js', 'window.__ENV__ = ' + JSON.stringify(env) + ';\n');
"
echo "[entrypoint] env.js written"

# ── Sync server ────────────────────────────────────────────────────────────────
SYNC_TOKEN="${SYNC_TOKEN:-}" DATA_DIR="/data" node /sync-server/server.js &

# ── Hand off to nginx (CMD argument) ──────────────────────────────────────────
exec "$@"
