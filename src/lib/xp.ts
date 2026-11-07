/**
 * EXP from battles, Gen III and IV — the games' own formula, as in
 * pret/pokeemerald (Cmd_getexp, src/battle_script_commands.c) and
 * pret/pokeplatinum (src/battle/battle_script.c):
 *
 *   per defeated Pokémon: floor(base EXP yield × its level / 7)
 *   with an Exp. Share held by anyone in the party: half is split between the
 *     Pokémon that fought it, half between the Exp. Share holders
 *   then for each Pokémon, each step rounded down: × 1.5 holding a Lucky Egg,
 *     × 1.5 in a trainer battle, × 1.5 if it isn't your own catch (× 1.7 in
 *     Gen IV when it is also from a game in another language)
 *
 * Pure: the base EXP tables and trainer parties are in src/data/xp-trainers.json
 * (scripts/fetch-xp-data.ts), loaded by the caller.
 */
import type { EncounterDetail, Pokemon } from "../types";

export interface XpTrainer {
  /** The decompilation's constant, e.g. TRAINER_ELITE_FOUR_AARON_REMATCH */
  id: string;
  name: string;
  /** Trainer class as words: "Ace Trainer", "Elite Four" */
  cls: string;
  /** Where they stand */
  where: string;
  /** 0 = the first battle; 1, 2, … = later rematch teams */
  tier: number;
  kind: "rematch" | "league" | "leader";
  double?: boolean;
  /** [species, level] per Pokémon */
  party: [number, number][];
  /** EXP for one Pokémon that fought the whole battle alone: own catch, no Lucky Egg */
  exp: number;
  /**
   * HG/SS phone rematches: they only agree to one when you call on this
   * weekday (0 = Sunday … 6 = Saturday) at this Gen IV time of day; null = any
   * (files/tel/pmtel_book.json, checked by the phone scripts).
   */
  call?: { weekday: number | null; time: "morning" | "day" | "night" | null };
}

export type XpGame = "emerald" | "firered" | "diamond" | "platinum" | "heartgold";

export interface XpData {
  source: Record<string, string>;
  /** Base EXP yield by National Dex number, per generation */
  baseExp: Record<"3" | "4", number[]>;
  games: Record<XpGame, XpTrainer[]>;
}

/** floor(base × level / 7): what one defeated Pokémon gives before anything is split or multiplied */
export function defeatExp(base: number, level: number): number {
  return Math.floor((base * level) / 7);
}

/** One battle against a trainer's party, for a Pokémon that fought it alone (× 1.5 for a trainer battle) */
export function trainerExp(party: readonly (readonly [number, number])[], baseExp: readonly number[]): number {
  return party.reduce(
    (sum, [species, level]) => sum + Math.floor((defeatExp(baseExp[species] ?? 0, level) * 150) / 100),
    0,
  );
}

export interface Boosts {
  luckyEgg?: boolean;
  /** Not its original trainer's (traded) */
  traded?: boolean;
  /** Traded from a game in another language (Gen IV only) */
  foreign?: boolean;
}

/** The multiplier a Pokémon gets on top of a battle's EXP: Lucky Egg, traded */
export function boostFactor(gen: number, b: Boosts): number {
  let f = 1;
  if (b.luckyEgg) f *= 1.5;
  if (b.traded) f *= gen >= 4 && b.foreign ? 1.7 : 1.5;
  return f;
}

/**
 * How a Pokémon being trained gets its share:
 * alone      — it beats everything itself
 * share      — it holds the Exp. Share and sits in the party; a strong Pokémon fights (half)
 * switch     — it holds the Exp. Share, is sent out first and switched to the strong one (three quarters)
 * switchOnly — no Exp. Share in the party: sent out first and switched (half)
 */
export type TrainStyle = "alone" | "share" | "switch" | "switchOnly";

export const STYLE_SHARE: Record<TrainStyle, number> = { alone: 1, share: 0.5, switch: 0.75, switchOnly: 0.5 };

/**
 * Average EXP from one wild battle in an area: every encounter slot's chance ×
 * the EXP of the Pokémon in it, averaged over its level range. Only one
 * table's rows count (`table` undefined = the main one), and with a time of
 * day only that time's rows (Gen IV) — untimed rows always count.
 */
export function wildBattleExp(
  pokemon: readonly Pokemon[],
  slug: string,
  game: string,
  method: string,
  baseExp: readonly number[],
  time?: "morning" | "day" | "night",
): { exp: number; coverage: number; levels: [number, number] } | null {
  let exp = 0;
  let coverage = 0;
  let lo = Infinity;
  let hi = 0;
  for (const p of pokemon) {
    for (const e of p.encounters) {
      if (e.version !== game) continue;
      for (const l of e.locations) {
        if (l.locationAreaSlug !== slug) continue;
        for (const d of l.details as EncounterDetail[]) {
          if (d.method !== method || d.table || d.isStatic || d.chance <= 0) continue;
          if (d.timeOfDay && (time ? d.timeOfDay !== time : d.timeOfDay !== "day")) continue;
          let sum = 0;
          for (let lv = d.minLevel; lv <= d.maxLevel; lv++) sum += defeatExp(baseExp[p.id] ?? 0, lv);
          exp += (d.chance / 100) * (sum / (d.maxLevel - d.minLevel + 1));
          coverage += d.chance;
          lo = Math.min(lo, d.minLevel);
          hi = Math.max(hi, d.maxLevel);
        }
      }
    }
  }
  if (coverage === 0) return null;
  // Rates that don't add up to 100% (a partial table) are scaled up so the average stays an average
  return { exp: Math.round((exp * 100) / coverage), coverage, levels: [lo, hi] };
}

/** Gen III games use the Gen III base EXP table */
export const xpGenOf = (game: string): "3" | "4" =>
  ["ruby", "sapphire", "emerald", "firered", "leafgreen"].includes(game) ? "3" : "4";

interface SpotLike {
  trainers?: { game: XpGame; ids: string[] };
  rematches?: { game: XpGame; ids: string[] };
  wild?: { game: string; slug: string; method: string };
}

export interface SpotValue {
  /** EXP for one Pokémon that fought alone: one run (trainers), the best battle (rematches) or an average wild battle */
  exp: number;
  /** The trainers it is made of, in order */
  battles: XpTrainer[];
  wildLevels?: [number, number];
}

/** What a spot is worth, from the trainer data or the wild encounter tables; null if its data is missing */
export function spotValue(spot: SpotLike, data: XpData, pokemon: readonly Pokemon[]): SpotValue | null {
  const list = spot.trainers ?? spot.rematches;
  if (list) {
    const byId = new Map(data.games[list.game].map((t) => [t.id, t]));
    const battles = list.ids.map((id) => byId.get(id)).filter((t): t is XpTrainer => !!t);
    if (battles.length !== list.ids.length) return null;
    const exp = spot.trainers ? battles.reduce((s, t) => s + t.exp, 0) : Math.max(...battles.map((t) => t.exp));
    return { exp, battles };
  }
  if (spot.wild) {
    const w = wildBattleExp(
      pokemon,
      spot.wild.slug,
      spot.wild.game,
      spot.wild.method,
      data.baseExp[xpGenOf(spot.wild.game)],
    );
    return w ? { exp: w.exp, battles: [], wildLevels: w.levels } : null;
  }
  return null;
}

/** "12,345" */
export const fmtExp = (n: number) => Math.round(n).toLocaleString("en-US");
