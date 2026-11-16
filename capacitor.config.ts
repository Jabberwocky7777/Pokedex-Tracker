import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Permanent: the iOS bundle id and the Android application id. Android treats a new id as another app.
  appId: "com.local.pokedextracker",
  appName: "Pokédex Tracker",
  webDir: "dist",
  // The dark theme's background, so the web view never flashes white while it starts
  backgroundColor: "#030712",
  android: {
    // The oldest Android System WebView (Chromium) the app runs in: Tailwind's
    // stylesheet is in cascade layers (99); newer CSS has fallbacks, and the
    // script is built for this version (CHROMIUM_FLOOR in vite.config.ts). Keep
    // the two equal. An older WebView gets errorPath instead of a blank screen.
    minWebViewVersion: 99,
  },
  server: {
    errorPath: "webview-too-old.html",
  },
};

export default config;
