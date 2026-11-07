import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { Capacitor } from "@capacitor/core";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/shared/ErrorBoundary.tsx";
import { startUrlRouting } from "./lib/url-route.ts";

// Offline support in a browser. Not in the iOS app: its files are already on
// the device, and WKWebView has no service workers for the app's own scheme.
// (In the dev server this is a no-op; only production builds have a worker.)
//
// A new version downloads in the background and then waits. It takes over the
// next time the app is out of sight (switched away from, or closed), so the page
// never reloads under someone using it — on a slow connection the download can
// take a minute, and the reload used to land in the middle of whatever they were doing.
//
// A home-screen app on iOS is resumed rather than reloaded, so the check made when
// the page loads may never run again: it also checks on every return and hourly.
// iOS can suspend the page as it hides, before the reload happens, so a version that
// is still waiting is also applied on the way back, before anything has been touched.
if (!Capacitor.isNativePlatform()) {
  let updateReady = false;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      if (document.hidden) void updateSW(true);
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) check();
      });
    },
  });
  document.addEventListener("visibilitychange", () => {
    if (updateReady) void updateSW(true);
  });
}

// Double-click any number input to select all — makes it easy to retype a value.
document.addEventListener("dblclick", (e) => {
  const el = e.target as HTMLElement;
  if (el instanceof HTMLInputElement && (el.type === "number" || el.inputMode === "numeric")) {
    el.select();
  }
});

// The address bar follows the open tab, and Back / Forward move between tabs
startUrlRouting();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
