/**
 * A team's type coverage, for the Designer's team view: which attacking types
 * several members are weak to and few resist, and which defending types the
 * team's damaging moves hit super-effectively or can't touch. Pure; types are
 * as of Generation IV (the type chart in lib/damage-calc.ts).
 */
import { typeEffectiveness } from "./damage-calc";

export const TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
] as const;

export interface DefenceRow {
  type: string;
  /** Members taking 2× or more */
  weak: number;
  /** Members taking ½× or less, immunities included */
  resist: number;
  immune: number;
  /** Weak members outnumber resisting ones by two or more: a hole in the team */
  shared: boolean;
}

/** One row per attacking type, for the members' types (each member one or two types). */
export function defenceTable(members: string[][]): DefenceRow[] {
  return TYPES.map((type) => {
    const mults = members.map((types) => typeEffectiveness(type, types));
    const weak = mults.filter((m) => m >= 2).length;
    const resist = mults.filter((m) => m <= 0.5).length;
    return { type, weak, resist, immune: mults.filter((m) => m === 0).length, shared: weak - resist >= 2 };
  });
}

export interface Coverage {
  /** Defending types at least one move hits for 2× */
  superEffective: string[];
  /** Defending types every move hits for ½× or less */
  walled: string[];
}

/** What the team's damaging move types hit, against each single defending type. */
export function offenceCoverage(moveTypes: string[]): Coverage {
  const types = [...new Set(moveTypes.map((t) => t.toLowerCase()))];
  if (types.length === 0) return { superEffective: [], walled: [] };
  const best = (defender: string) => Math.max(...types.map((t) => typeEffectiveness(t, [defender])));
  return {
    superEffective: TYPES.filter((d) => best(d) >= 2),
    walled: TYPES.filter((d) => best(d) <= 0.5),
  };
}
