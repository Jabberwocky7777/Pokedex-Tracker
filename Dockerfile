# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Uses Node 22 Alpine to install deps and run `npm run build`.
# node_modules and source are NOT included in the final image.
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first so Docker can cache the npm ci layer.
# If package.json and package-lock.json haven't changed, this layer is reused.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy the rest of the source and build.
COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
# Final image is nginx:alpine (~10 MB). Only the compiled dist/ is copied over.
FROM nginx:alpine AS final

# Remove the default nginx config and replace with our SPA-aware config.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the builder stage.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
