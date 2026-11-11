import { safeSetItem } from "./safe-storage";

export type LegibilityLevel = "off" | "comfortable" | "large";

export function applyLegibility(level: LegibilityLevel) {
  document.documentElement.dataset.legible = level;
  safeSetItem("pdx-legible", level);
}
