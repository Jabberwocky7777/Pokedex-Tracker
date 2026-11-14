import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Permanent: the iOS bundle id and the Android application id. Android treats a new id as another app.
  appId: "com.local.pokedextracker",
  appName: "Pokédex Tracker",
  webDir: "dist",
  // The dark theme's background, so the web view never flashes white while it starts
  backgroundColor: "#030712",
  android: {
    // Tailwind 4 needs Chromium 111 or later. An older Android System WebView gets
    // errorPath (public/webview-too-old.html) instead of a blank screen.
    minWebViewVersion: 111,
  },
  server: {
    errorPath: "webview-too-old.html",
  },
};

export default config;
