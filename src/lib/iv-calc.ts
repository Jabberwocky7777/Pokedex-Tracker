/**
 * Pokémon IV calculation formulas (Gen III+).
 * IVs range 0–31 with nature multipliers.
 */

export type StatKey = "hp" | "atk" | "def" | "spAtk" | "spDef" | "spe";

export const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spAtk", "spDef", "spe"];

export const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spAtk: "Sp. Atk",
  spDef: "Sp. Def",
  spe: "Speed",
};

// ─── Natures ────────────────────────────────────────────────────────────────

export interface Nature {
  name: string;
  /** Stat boosted by 10% (null = neutral) */
  plus: StatKey | null;
  /** Stat hindered by 10% (null = neutral) */
  minus: StatKey | null;
}

export const NATURES: Nature[] = [
  { name: "Hardy",   plus: null,    minus: null },
  { name: "Lonely",  plus: "atk",   minus: "def" },
  { name: "Brave",   plus: "atk",   minus: "spe" },
  { name: "Adamant", plus: "atk",   minus: "spAtk" },
  { name: "Naughty", plus: "atk",   minus: "spDef" },
  { name: "Bold",    plus: "def",   minus: "atk" },
  { name: "Docile",  plus: null,    minus: null },
  { name: "Relaxed", plus: "def",   minus: "spe" },
  { name: "Impish",  plus: "def",   minus: "spAtk" },
  { name: "Lax",     plus: "def",   minus: "spDef" },
  { name: "Timid",   plus: "spe",   minus: "atk" },
  { name: "Hasty",   plus: "spe",   minus: "def" },
  { name: "Serious", plus: null,    minus: null },
  { name: "Jolly",   plus: "spe",   minus: "spAtk" },
  { name: "Naive",   plus: "spe",   minus: "spDef" },
  { name: "Modest",  plus: "spAtk", minus: "atk" },
  { name: "Mild",    plus: "spAtk", minus: "def" },
  { name: "Quiet",   plus: "spAtk", minus: "spe" },
  { name: "Bashful", plus: null,    minus: null },
  { name: "Rash",    plus: "spAtk", minus: "spDef" },
  { name: "Calm",    plus: "spDef", minus: "atk" },
  { name: "Gentle",  plus: "spDef", minus: "def" },
  { name: "Sassy",   plus: "spDef", minus: "spe" },
  { name: "Careful", plus: "spDef", minus: "spAtk" },
  { name: "Quirky",  plus: null,    minus: null },
];

export function getNatureMultiplier(nature: Nature, stat: StatKey): number {
  if (stat === "hp") return 1;
  if (nature.plus === stat) return 1.1;
  if (nature.minus === stat) return 0.9;
  return 1;
}

// ─── Gen III / IV formulas ────────────────────────────────────────────────

/**
 * Calculate HP stat (Gen III+).
 * Formula: floor((2*Base + IV + floor(EV/4)) * Level / 100) + Level + 10
 */
export function calcHPStat(base: number, iv: number, ev: number, level: number): number {
  return Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10;
}

/**
 * Calculate non-HP stat (Gen III+).
 * Formula: floor((floor((2*Base + IV + floor(EV/4)) * Level / 100) + 5) * Nature)
 */
export function calcStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  natureMultiplier: number
): number {
  return Math.floor(
    (Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5) * natureMultiplier
  );
}

/**
 * Find all IVs (0–31) that produce the given observed stat value.
 * Returns an array of matching IVs (usually 1–4 values).
 */
export function findIVs(
  base: number,
  ev: number,
  level: number,
  natureMultiplier: number,
  observedStat: number,
  isHP: boolean
): number[] {
  const results: number[] = [];
  for (let iv = 0; iv <= 31; iv++) {
    const computed = isHP
      ? calcHPStat(base, iv, ev, level)
      : calcStat(base, iv, ev, level, natureMultiplier);
    if (computed === observedStat) {
      results.push(iv);
    }
  }
  return results;
}

/**
 * Returns the min and max of the matching IV array, or null if no match.
 */
export function ivRange(ivs: number[]): { min: number; max: number } | null {
  if (ivs.length === 0) return null;
  return { min: Math.min(...ivs), max: Math.max(...ivs) };
}

/**
 * Returns IVs present in every set (intersection).
 * Used to narrow IV possibilities across multiple level entries.
 * Rows with no valid stat input (empty sets) are skipped.
 */
export function intersectIVSets(sets: number[][]): number[] {
  if (sets.length === 0) return [];
  const first = sets.find((s) => s.length > 0);
  if (!first) return [];
  return sets.reduce((acc, cur) => acc.filter((iv) => cur.includes(iv)), first);
}

/**
 * Find the lowest level >= fromLevel at which the given IV candidates would
 * produce different stat values (i.e. checking at that level would narrow the range).
 * Returns null if the candidates never diverge between fromLevel and 100.
 */
export function nextDivergentLevel(
  candidates: number[],
  base: number,
  ev: number,
  natureMult: number,
  isHP: boolean,
  fromLevel: number
): number | null {
  if (candidates.length <= 1) return null;
  for (let lv = Math.max(1, fromLevel); lv <= 100; lv++) {
    const vals = new Set(
      candidates.map((iv) =>
        isHP ? calcHPStat(base, iv, ev, lv) : calcStat(base, iv, ev, lv, natureMult)
      )
    );
    if (vals.size > 1) return lv;
  }
  return null;
}

/**
 * Calculate Hidden Power type and base power from confirmed IVs (Gen III/IV formula).
 * Returns null if any IV is missing.
 */
export function calculateHiddenPower(
  ivs: Record<StatKey, number>
): { type: string; power: number } | null {
  const order: StatKey[] = ["hp", "atk", "def", "spe", "spAtk", "spDef"];
  const TYPES = [
    "fighting", "flying", "poison", "ground", "rock", "bug",
    "ghost", "steel", "fire", "water", "grass", "electric",
    "psychic", "ice", "dragon", "dark",
  ];

  for (const k of order) {
    if (ivs[k] == null) return null;
  }

  const typeBits = order.map((k, i) => ((ivs[k] & 1) << i));
  const powerBits = order.map((k, i) => (((ivs[k] >> 1) & 1) << i));

  const typeIndex = Math.floor((typeBits.reduce((a, b) => a + b, 0) * 15) / 63);
  const power = Math.floor((powerBits.reduce((a, b) => a + b, 0) * 40) / 63) + 30;

  return { type: TYPES[typeIndex], power };
}
