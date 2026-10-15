import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { Capacitor } from "@capacitor/core";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/shared/ErrorBoundary.tsx";

// Offline support in a browser. Not in the iOS app: its files are already on
// the device, and WKWebView has no service workers for the app's own scheme.
// (In the dev server this is a no-op; only production builds have a worker.)
//
// A new version downloads in the background and then waits. It takes over the
// next time the app is out of sight (switched away from, or closed), so the page
// never reloads under someone using it — on a slow connection the download can
// take a minute, and the reload used to land in the middle of whatever they were doing.
if (!Capacitor.isNativePlatform()) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const applyWhenHidden = () => {
        if (!document.hidden) return;
        document.removeEventListener("visibilitychange", applyWhenHidden);
        void updateSW(true);
      };
      if (document.hidden) applyWhenHidden();
      else document.addEventListener("visibilitychange", applyWhenHidden);
    },
  });
}

// Double-click any number input to select all — makes it easy to retype a value.
document.addEventListener("dblclick", (e) => {
  const el = e.target as HTMLElement;
  if (
    el instanceof HTMLInputElement &&
    (el.type === "number" || el.inputMode === "numeric")
  ) {
    el.select();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
