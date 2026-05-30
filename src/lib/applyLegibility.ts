export type LegibilityLevel = "off" | "comfortable" | "large";

export function applyLegibility(level: LegibilityLevel) {
  document.documentElement.dataset.legible = level;
  localStorage.setItem("pdx-legible", level);
}
