import type { Gen3VersionGroup, VersionGroup } from "../../lib/move-fetch";
import { GEN3_MACHINES } from "./gen3-machines";
import { GEN4_MACHINES } from "./gen4-machines";

// ── Base stat display config ──────────────────────────────────────────────────

export const STAT_CONFIG = [
  { key: "hp", label: "HP" },
  { key: "atk", label: "Attack" },
  { key: "def", label: "Defense" },
  { key: "spAtk", label: "Sp. Atk" },
  { key: "spDef", label: "Sp. Def" },
  { key: "spe", label: "Speed" },
] as const;

export function statBarColor(val: number): string {
  if (val < 65) return "var(--theme-stat-low)";
  if (val <= 90) return "var(--theme-stat-mid)";
  return "var(--theme-stat-high)";
}

// ── Version groups that use the Gen III physical/special type split ───────────
// Gen IV+ games use the per-move category system, so they must NOT be in this set.

export const GEN3_SPLIT_VERSION_GROUPS = new Set<Gen3VersionGroup>(["ruby-sapphire", "emerald", "firered-leafgreen"]);

// ── Machine map lookup ────────────────────────────────────────────────────────
// Returns the correct TM/HM record for any version group.

export function getMachines(versionGroup: VersionGroup): Record<string, string> {
  return (GEN3_SPLIT_VERSION_GROUPS as Set<string>).has(versionGroup) ? GEN3_MACHINES : GEN4_MACHINES;
}
