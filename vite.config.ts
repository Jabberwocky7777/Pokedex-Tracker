import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// `vite preview` sends the Content-Security-Policy the nginx image sends, so a
// production build can be checked against it without Docker. (Not the dev
// server: Vite's hot reload needs inline scripts the policy forbids.)
const csp = /add_header\s+Content-Security-Policy\s+"([^"]+)"/.exec(
  readFileSync(new URL('./nginx-security-headers.conf', import.meta.url), 'utf8'),
)?.[1]

const apiProxy = {
  // Start the sync server with: SYNC_TOKEN=dev-token node sync-server/server.js
  "/api": "http://localhost:3001",
  // LoginScreen checks /health to decide whether to show the login form
  "/health": "http://localhost:3001",
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
  },
  // In dev and preview, proxy /api/* to the sync server running locally.
  server: { proxy: apiProxy },
  preview: {
    proxy: apiProxy,
    headers: csp ? { "Content-Security-Policy": csp } : {},
  },
})
