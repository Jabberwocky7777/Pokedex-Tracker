import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// `vite preview` sends the Content-Security-Policy the nginx image sends, so a
// production build can be checked against it without Docker. (Not the dev
// server: Vite's hot reload needs inline scripts the policy forbids.)
const csp = /add_header\s+Content-Security-Policy\s+"([^"]+)"/.exec(
  readFileSync(new URL('./deploy/nginx/security-headers.conf', import.meta.url), 'utf8'),
)?.[1]

// The address this build is served at (`SITE_URL=https://… npm run build`; the
// image takes it as a build argument). With it, link previews get absolute URLs
// (og:url, og:image) and robots.txt invites crawlers, with a sitemap. Without it
// — a private self-hosted instance — those meta tags are left out and robots.txt
// asks crawlers to stay away.
const siteUrl = (process.env.SITE_URL ?? '').trim().replace(/\/+$/, '')

function siteUrlPlugin(): Plugin {
  return {
    name: 'site-url',
    transformIndexHtml(html) {
      return siteUrl
        ? html.replaceAll('%SITE_URL%', siteUrl)
        : html.replace(/^[ \t]*<meta [^>]*%SITE_URL%[^>]*>\r?\n/gm, '')
    },
    generateBundle() {
      const robots = siteUrl
        ? `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
        : 'User-agent: *\nDisallow: /\n'
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      if (siteUrl) {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            `  <url><loc>${siteUrl}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>`,
            '</urlset>',
            '',
          ].join('\n'),
        })
      }
    },
  }
}

const apiProxy = {
  // Start the sync server with: SYNC_TOKEN=dev-token node sync-server/server.js
  // (127.0.0.1, not localhost: the server listens on IPv4 loopback only, and
  // localhost can resolve to ::1 first)
  "/api": "http://127.0.0.1:3001",
  // LoginScreen checks /health to decide whether to show the login form
  "/health": "http://127.0.0.1:3001",
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    siteUrlPlugin(),
    // Offline use in a browser: a service worker that keeps the app shell and
    // the data files, and a manifest so the app installs to the home screen.
    // Production builds only. The iOS app never registers it (see main.tsx).
    VitePWA({
      // A new version waits; main.tsx switches to it while the app is out of sight
      registerType: "prompt",
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
        globPatterns: ["**/*.{js,css,html,json,svg,png,webmanifest,woff2}"],
        // Only link previews fetch this; the app never shows it
        globIgnores: ["og-image.png"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // The sync API always goes to the network, and is never answered with the app shell
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
        cleanupOutdatedCaches: true,
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
