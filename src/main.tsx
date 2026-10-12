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
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });

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
