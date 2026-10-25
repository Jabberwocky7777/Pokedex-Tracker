# Build from the repository root: docker build -f deploy/Dockerfile .
# (the context is the repo root, so COPY paths below are relative to it)
#
# The base image is pinned by digest so a build is reproducible; Dependabot
# (docker ecosystem, /deploy) proposes the new digest when node:22-alpine moves.
ARG NODE_IMAGE=node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

# ── Stage 1: Build React app ───────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder

# The address the instance is served at, for link previews (og:url, og:image),
# robots.txt and sitemap.xml. Left empty, those tags are omitted and robots.txt
# asks crawlers to stay out — right for a private instance.
ARG SITE_URL=

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN SITE_URL="$SITE_URL" npm run build

# ── Stage 2: Install sync server dependencies ──────────────────────────────────
FROM ${NODE_IMAGE} AS sync-deps

WORKDIR /sync-server
COPY sync-server/package.json sync-server/package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 3: Combined runtime ──────────────────────────────────────────────────
# Single container: nginx serves the SPA + Node runs the sync API on :3001.
# nginx proxies /api/* to 127.0.0.1:3001 so everything stays same-origin.
# Auth is handled in the React app — no nginx Basic Auth needed.
FROM ${NODE_IMAGE} AS final

# nginx, and su-exec so the entrypoint can run the sync server as the
# unprivileged `node` user (nginx's master binds port 80 as root; its workers
# already run as `nginx`)
RUN apk add --no-cache nginx su-exec \
 && rm -f /etc/nginx/http.d/default.conf

# nginx config (SPA routing + /api/ proxy to 127.0.0.1:3001 + rate limiting + gzip + security headers)
COPY deploy/nginx/default.conf /etc/nginx/http.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/pokedex-security-headers.conf
COPY deploy/nginx/real-ip.conf /etc/nginx/pokedex-real-ip.conf
# Fail the build, not the deployment, if the config has a mistake
RUN nginx -t

# Built React SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Sync server
COPY --from=sync-deps /sync-server/node_modules /sync-server/node_modules
COPY sync-server/server.js /sync-server/server.js

# Startup script: starts sync server, then starts nginx
COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
 && mkdir -p /data \
 && chown node:node /data

# Keeps Express from putting stack traces in error responses
ENV NODE_ENV=production

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
