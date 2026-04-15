/**
 * Gen III / Gen IV catch rate formula.
 * Source: https://bulbapedia.bulbagarden.net/wiki/Catch_rate
 *
 * Ruby/Sapphire bug: Bad Poison doesn't apply 1.5× status bonus.
 * Fixed in Emerald, FireRed, LeafGreen — and Gen IV.
 * We use the corrected formula for all games.
 */

export type BallId =
  | "poke"
  | "great"
  | "ultra"
  | "master"
  | "safari"
  | "sport"
  | "premier"
  | "luxury"
  | "heal"
  | "repeat"
  | "timer"
  | "nest"
  | "net"
  | "dive"
  | "level";

export interface Ball {
  id: BallId;
  name: string;
  /** Static bonus multiplier, or null if computed dynamically */
  bonus: number | null;
  /** Description of dynamic calculation */
  note?: string;
}

export const BALLS: Ball[] = [
  { id: "poke",    name: "Poké Ball",    bonus: 1 },
  { id: "great",   name: "Great Ball",   bonus: 1.5 },
  { id: "ultra",   name: "Ultra Ball",   bonus: 2 },
  { id: "master",  name: "Master Ball",  bonus: null, note: "Always catches" },
  { id: "safari",  name: "Safari Ball",  bonus: 1.5 },
  { id: "sport",   name: "Sport Ball",   bonus: 1.5 },
  { id: "repeat",  name: "Repeat Ball",  bonus: 3, note: "3× if seen in Pokédex" },
  { id: "timer",   name: "Timer Ball",   bonus: null, note: "Bonus = 1 + turns/10 (max 4 at turn 30+)" },
  { id: "nest",    name: "Nest Ball",    bonus: null, note: "Bonus = max(1, (41 − level) / 10)" },
  { id: "net",     name: "Net Ball",     bonus: null, note: "3× for Water or Bug types; else 1×" },
  { id: "dive",    name: "Dive Ball",    bonus: 3.5, note: "3.5× when surfing or diving" },
  { id: "level",   name: "Level Ball",   bonus: null, note: "Depends on player's lead Pokémon level" },
  { id: "luxury",  name: "Luxury Ball",  bonus: 1 },
  { id: "heal",    name: "Heal Ball",    bonus: 1 },
  { id: "premier", name: "Premier Ball", bonus: 1 },
];

export type StatusId = "none" | "sleep" | "frozen" | "paralyzed" | "poisoned" | "burned";

export interface StatusCondition {
  id: StatusId;
  name: string;
  multiplier: number;
}

export const STATUS_CONDITIONS: StatusCondition[] = [
  { id: "none",      name: "No status",  multiplier: 1 },
  { id: "sleep",     name: "Sleep",      multiplier: 2 },
  { id: "frozen",    name: "Frozen",     multiplier: 2 },
  { id: "paralyzed", name: "Paralyzed",  multiplier: 1.5 },
  { id: "poisoned",  name: "Poisoned",   multiplier: 1.5 },
  { id: "burned",    name: "Burned",     multiplier: 1.5 },
];

export interface CatchRateInputs {
  /** Species catch rate (0–255) */
  catchRate: number;
  /** Target's max HP */
  maxHP: number;
  /** Target's current HP (1–maxHP) */
  currentHP: number;
  /** Ball bonus multiplier */
  ballBonus: number;
  /** Status multiplier */
  statusMultiplier: number;
}

export interface CatchRateResult {
  /** Modified catch rate value (a) */
  a: number;
  /** Shake threshold (b) — 0 to 65535 */
  b: number;
  /** Whether the catch is guaranteed (a >= 255) */
  guaranteed: boolean;
  /** Probability of passing one shake check */
  shakeChance: number;
  /** Final catch probability (4 shake checks) */
  catchChance: number;
}

/**
 * Computes Gen III / IV catch probability.
 */
export function calcCatchRate(inputs: CatchRateInputs): CatchRateResult {
  const { catchRate, maxHP, currentHP, ballBonus, statusMultiplier } = inputs;

  if (maxHP <= 0) {
    return { a: 0, b: 0, guaranteed: false, shakeChance: 0, catchChance: 0 };
  }

  const clampedHP = Math.max(1, Math.min(currentHP, maxHP));

  const a = Math.floor(
    ((3 * maxHP - 2 * clampedHP) * catchRate * ballBonus * statusMultiplier) /
      (3 * maxHP)
  );

  if (a >= 255) {
    return { a, b: 65535, guaranteed: true, shakeChance: 1, catchChance: 1 };
  }

  if (a <= 0) {
    return { a: 0, b: 0, guaranteed: false, shakeChance: 0, catchChance: 0 };
  }

  // b = floor(65536 / sqrt(sqrt(255 / a)))
  const b = Math.floor(65536 / Math.sqrt(Math.sqrt(255 / a)));
  const shakeChance = b / 65536;
  const catchChance = Math.pow(shakeChance, 4);

  return { a, b, guaranteed: false, shakeChance, catchChance };
}

/** Ball IDs whose bonus is computed dynamically (bonus === null in BALLS). */
export type DynamicBallId = "timer" | "nest" | "net" | "level";

/** Ball bonus for balls with dynamic bonuses */
export function getDynamicBallBonus(
  ballId: DynamicBallId,
  opts: {
    turns?: number;
    targetLevel?: number;
    leadLevel?: number;
    targetTypes?: string[];
    inWater?: boolean;
  }
): number {
  switch (ballId) {
    case "timer": {
      const turns = opts.turns ?? 1;
      return Math.min(4, 1 + turns / 10);
    }
    case "nest": {
      const level = opts.targetLevel ?? 5;
      return Math.max(1, (41 - level) / 10);
    }
    case "net": {
      const types = opts.targetTypes ?? [];
      return types.some((t) => t === "water" || t === "bug") ? 3 : 1;
    }
    case "level": {
      const lead = opts.leadLevel ?? 1;
      const target = opts.targetLevel ?? 1;
      if (lead >= target * 4) return 8;
      if (lead >= target * 2) return 4;
      if (lead > target) return 2;
      return 1;
    }
    default: {
      const _exhaustive: never = ballId;
      return _exhaustive;
    }
  }
}
