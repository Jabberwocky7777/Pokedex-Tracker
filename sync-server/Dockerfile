# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
FROM node:22-alpine AS final

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY server.js .

# /data is the volume mount point for the persistent JSON file
RUN mkdir -p /data

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server.js"]
