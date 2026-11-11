// Component tests (*.test.tsx) run in jsdom, which has its own localStorage and
// IndexedDB-less window. Unmount whatever a test rendered, and start each test
// with empty storage.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
