import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/shared/ErrorBoundary.tsx";

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
