import type { StatKey } from "../../lib/iv-calc";

// ── Level entry (a row in the stat-entry table) ──────────────────────────────

export interface LevelEntry {
  id: number;
  level: number;
  stats: Record<StatKey, string>;
}

export const EMPTY_STATS = (): Record<StatKey, string> => ({
  hp: "", atk: "", def: "", spAtk: "", spDef: "", spe: "",
});

export const DEFAULT_IVS = (): Record<StatKey, number> => ({
  hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spe: 31,
});

export const DEFAULT_EVS = (): Record<StatKey, number> => ({
  hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0,
});

// ── IV badge color helpers ────────────────────────────────────────────────────

export function ivColor(min: number, max: number): string {
  if (min >= 31) return "text-green-400";
  if (min >= 25) return "text-yellow-400";
  if (max <= 10) return "text-red-400";
  return "text-gray-300";
}

export function ivBadgeColor(min: number, max: number): string {
  if (min >= 31) return "bg-green-900/60 border-green-700 text-green-300";
  if (min >= 25) return "bg-yellow-900/60 border-yellow-700 text-yellow-300";
  if (max <= 10) return "bg-red-900/60 border-red-700 text-red-300";
  return "bg-gray-800 border-gray-700 text-gray-300";
}
