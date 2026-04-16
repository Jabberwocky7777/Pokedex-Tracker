#!/bin/sh
# Writes /usr/share/nginx/env/env.js from container environment variables
# at startup, so the frontend can read runtime config without a rebuild.
# If SYNC_TOKEN is empty, sync is silently disabled in the frontend.
set -e

mkdir -p /usr/share/nginx/env
printf 'window.__ENV__ = { SYNC_TOKEN: "%s", SYNC_URL: "%s" };\n' \
  "${SYNC_TOKEN:-}" \
  "${SYNC_URL:-}" \
  > /usr/share/nginx/env/env.js

exec "$@"
