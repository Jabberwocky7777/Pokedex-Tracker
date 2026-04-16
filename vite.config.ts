import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev, proxy /api/* to the sync server running locally.
    // Start the sync server with: SYNC_TOKEN=dev-token node sync-server/server.js
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
})
