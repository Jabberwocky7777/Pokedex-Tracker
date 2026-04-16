# ── Stage 1: Build React app ───────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Stage 2: Install sync server dependencies ──────────────────────────────────
FROM node:22-alpine AS sync-deps

WORKDIR /sync-server
COPY sync-server/package.json ./
RUN npm install --omit=dev

# ── Stage 3: Combined runtime ──────────────────────────────────────────────────
# Single container: nginx serves the SPA + Node runs the sync API on :3001.
# nginx proxies /api/* to localhost:3001 so everything stays same-origin.
FROM node:22-alpine AS final

# Install nginx (Alpine package manager)
RUN apk add --no-cache nginx \
 && rm -f /etc/nginx/http.d/default.conf

# nginx config (SPA routing + /api/ proxy to localhost:3001)
COPY nginx.conf /etc/nginx/http.d/default.conf

# Built React SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Sync server
COPY --from=sync-deps /sync-server/node_modules /sync-server/node_modules
COPY sync-server/server.js /sync-server/server.js

# Startup script: writes env.js, starts sync server, then starts nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
 && mkdir -p /data /usr/share/nginx/env

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
