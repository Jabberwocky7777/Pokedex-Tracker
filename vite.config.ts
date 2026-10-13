import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
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
  plugins: [
    react(),
    tailwindcss(),
    // Offline use in a browser: a service worker that keeps the app shell and
    // the data files, and a manifest so the app installs to the home screen.
    // Production builds only. The iOS app never registers it (see main.tsx).
    VitePWA({
      registerType: "autoUpdate",
      // main.tsx registers it, so the native app can opt out
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons.svg", "apple-touch-icon.png", "theme-init.js"],
      manifest: {
        name: "Pokédex Tracker",
        short_name: "Pokédex",
        description: "Track your Pokémon collection across Gen III and Gen IV.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#030712",
        theme_color: "#030712",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Everything the app is made of, including the data files in /data
        // (pokemon.json is ~4.3 MB, over the default 2 MB limit)
        globPatterns: ["**/*.{js,css,html,json,svg,png,webmanifest}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // The sync API always goes to the network, and is never answered with the app shell
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
        cleanupOutdatedCaches: true,
        // With injectRegister off the plugin doesn't switch these on itself; without
        // them a new build would wait until every window of the app had been closed
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Sprites are kept as they are seen, so the ones you have looked at show offline.
            // Requested with CORS: an opaque response would count as ~7 MB each against the quota.
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\//,
            handler: "CacheFirst",
            options: {
              cacheName: "sprites",
              fetchOptions: { mode: "cors", credentials: "omit" },
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 3000, maxAgeSeconds: 180 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
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
