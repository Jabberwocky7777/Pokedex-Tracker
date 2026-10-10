/**
 * Gen 4 (DPP/HGSS) damage formula implementation.
 * Formula reference: Bulbapedia — Damage (Generation IV)
 */

import type { CalcPokemon, DamageResult, WeatherCondition, CalcMove } from "../types/battleTower";

// ─── Type effectiveness chart (Gen 4, 17 types) ──────────────────────────────

// Type effectiveness multipliers indexed as [attacking type][defending type]
// Using Bulbapedia Gen IV type chart
const TYPE_CHART: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5, grass: 2, ice: 2, bug: 2, steel: 2 },
  water:    { water: 0.5, grass: 0.5, dragon: 0.5, fire: 2, ground: 2, rock: 2 },
  electric: { electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0, flying: 2, water: 2 },
  grass:    { fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5, water: 2, ground: 2, rock: 2 },
  ice:      { water: 0.5, ice: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, bug: 0.5, psychic: 0.5, flying: 0.5, ghost: 0 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground:   { poison: 2, rock: 2, steel: 2, electric: 2, fire: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying:   { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug:      { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, poison: 0.5 },
  rock:     { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost:    { ghost: 2, psychic: 2, normal: 0, dark: 0.5, steel: 0.5 },
  dragon:   { dragon: 2, steel: 0.5 },
  dark:     { ghost: 2, psychic: 2, dark: 0.5, fighting: 0.5, steel: 0.5 },
  steel:    { ice: 2, rock: 2, steel: 0.5, fire: 0.5, water: 0.5, electric: 0.5 },
};

export function typeEffectiveness(moveType: string, defenderTypes: string[]): number {
  let mult = 1;
  for (const dt of defenderTypes) {
    const row = TYPE_CHART[moveType.toLowerCase()];
    mult *= row?.[dt.toLowerCase()] ?? 1;
  }
  return mult;
}

// ─── Nature modifiers ─────────────────────────────────────────────────────────

const NATURE_MODS: Record<string, { plus: keyof CalcPokemon["stats"] | null; minus: keyof CalcPokemon["stats"] | null }> = {
  Hardy: { plus: null, minus: null },
  Lonely: { plus: "atk", minus: "def" },
  Brave: { plus: "atk", minus: "spe" },
  Adamant: { plus: "atk", minus: "spa" },
  Naughty: { plus: "atk", minus: "spd" },
  Bold: { plus: "def", minus: "atk" },
  Docile: { plus: null, minus: null },
  Relaxed: { plus: "def", minus: "spe" },
  Impish: { plus: "def", minus: "spa" },
  Lax: { plus: "def", minus: "spd" },
  Timid: { plus: "spe", minus: "atk" },
  Hasty: { plus: "spe", minus: "def" },
  Serious: { plus: null, minus: null },
  Jolly: { plus: "spe", minus: "spa" },
  Naive: { plus: "spe", minus: "spd" },
  Modest: { plus: "spa", minus: "atk" },
  Mild: { plus: "spa", minus: "def" },
  Quiet: { plus: "spa", minus: "spe" },
  Bashful: { plus: null, minus: null },
  Rash: { plus: "spa", minus: "spd" },
  Calm: { plus: "spd", minus: "atk" },
  Gentle: { plus: "spd", minus: "def" },
  Sassy: { plus: "spd", minus: "spe" },
  Careful: { plus: "spd", minus: "spa" },
  Quirky: { plus: null, minus: null },
};

// ─── Key ability effects ──────────────────────────────────────────────────────

/** "Thick Fat" / "thick-fat" / "thickfat" all compare equal. */
const normalize = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");

/** A multiplier as a fraction, so every step floors exactly as the games do. */
type Ratio = readonly [number, number];
const ONE: Ratio = [1, 1];
const times = (value: number, [num, den]: Ratio) => Math.floor((value * num) / den);

export interface AbilityModifiers {
  /** True if this Pokémon takes no damage from the given move type */
  isImmune: (moveType: string) => boolean;
  /** Applied to the move's base power when this Pokémon is hit (Thick Fat halves Fire and Ice) */
  defenseMult: (moveType: string) => Ratio;
  /** Applied to the move's base power when this Pokémon attacks (Technician) */
  powerMult: (basePower: number) => Ratio;
  /** Applied to this Pokémon's Attack or Sp. Atk (Huge Power, Guts, Hustle) */
  attackerStatMult: (isPhysical: boolean, hasStatus: boolean) => Ratio;
  /** Guts: a burn doesn't halve physical damage */
  ignoresBurn: boolean;
  /** True if no-damage from a non-super-effective move (Wonder Guard) */
  requiresSuperEffective: boolean;
  /** True if attacker's Atk is lowered when entering (Intimidate effect on opponent) */
  intimidatesOpponent: boolean;
  /** STAB override multiplier (Adaptability → 2 instead of 1.5) */
  stabMult: Ratio | null;
  /** Filter / Solid Rock: super-effective hits do 3/4 damage */
  reducesSuperEffective: boolean;
  /** Tinted Lens: resisted hits do double damage */
  doublesResisted: boolean;
  /** Magic Guard: no damage from hazards or weather */
  ignoresIndirectDamage: boolean;
}

const TYPE_IMMUNITY_ABILITIES: Record<string, string> = {
  levitate: "ground",
  voltabsorb: "electric",
  motordrive: "electric",
  waterabsorb: "water",
  dryskin: "water",
  flashfire: "fire",
};

export function getAbilityModifiers(ability: string): AbilityModifiers {
  const a = normalize(ability);

  return {
    isImmune: (moveType) => TYPE_IMMUNITY_ABILITIES[a] === moveType.toLowerCase(),
    defenseMult: (moveType) => {
      const t = moveType.toLowerCase();
      if (a === "thickfat" && (t === "fire" || t === "ice")) return [1, 2];
      if (a === "heatproof" && t === "fire") return [1, 2];
      if (a === "dryskin" && t === "fire") return [5, 4];
      return ONE;
    },
    powerMult: (basePower) => (a === "technician" && basePower <= 60 ? [3, 2] : ONE),
    attackerStatMult: (isPhysical, hasStatus) => {
      if (!isPhysical) return ONE;
      if (a === "hugepower" || a === "purepower") return [2, 1];
      if (a === "hustle") return [3, 2];
      if (a === "guts" && hasStatus) return [3, 2];
      return ONE;
    },
    ignoresBurn: a === "guts",
    requiresSuperEffective: a === "wonderguard",
    intimidatesOpponent: a === "intimidate",
    stabMult: a === "adaptability" ? [2, 1] : null,
    reducesSuperEffective: a === "filter" || a === "solidrock",
    doublesResisted: a === "tintedlens",
    ignoresIndirectDamage: a === "magicguard",
  };
}

// ─── Item effects ─────────────────────────────────────────────────────────────

export interface ItemEffect {
  /** Short description shown in the UI, e.g. "Choice Band (+50% Atk)" */
  label: string;
  /** Multiplier applied to raw Atk before the formula (physical moves) */
  atkStatMult?: number;
  /** Multiplier applied to raw SpA before the formula (special moves) */
  spaStatMult?: number;
  /** Multiplier applied to the base power of physical moves (Muscle Band) */
  physPowerMult?: number;
  /** Multiplier applied to the base power of special moves (Wise Glasses) */
  specPowerMult?: number;
  /** Multiplier applied to the damage of any move (Life Orb) */
  allDamageMult?: number;
  /** Multiplier applied after type effectiveness when the hit is super-effective (Expert Belt) */
  superEffMult?: number;
  /** Type whose moves get ×1.2 base power (type-boosting hold items) */
  boostType?: string;
}

/** Items that boost one specific type by ×1.2 */
const TYPE_BOOST_ITEMS: Record<string, string> = {
  "silk scarf":     "normal",
  "charcoal":       "fire",
  "mystic water":   "water",
  "magnet":         "electric",
  "miracle seed":   "grass",
  "never-melt ice": "ice",
  "black belt":     "fighting",
  "poison barb":    "poison",
  "soft sand":      "ground",
  "sharp beak":     "flying",
  "twisted spoon":  "psychic",
  "silver powder":  "bug",
  "hard stone":     "rock",
  "spell tag":      "ghost",
  "dragon fang":    "dragon",
  "black glasses":  "dark",
  "metal coat":     "steel",
};

/** Items that only work for certain species. */
const SPECIES_ITEMS: Record<string, string[]> = {
  "thick club": ["cubone", "marowak"],
  "light ball": ["pikachu"],
  "soul dew": ["latias", "latios"],
};

/**
 * Returns the damage/stat effect for a held item, or an empty-label object if
 * it has none. Pass the holder's species so Thick Club, Light Ball and Soul Dew
 * only count for the Pokémon they work on.
 */
export function getItemEffect(item: string, species?: string): ItemEffect {
  const i = item.toLowerCase().trim();
  const holders = SPECIES_ITEMS[i];
  if (holders && species !== undefined && !holders.includes(species.toLowerCase())) return { label: "" };
  if (i === "choice band")    return { label: "Choice Band (+50% Atk)",  atkStatMult: 1.5 };
  if (i === "choice specs")   return { label: "Choice Specs (+50% SpA)", spaStatMult: 1.5 };
  if (i === "choice scarf")   return { label: "Choice Scarf (+50% Spe)" }; // no damage effect
  if (i === "life orb")       return { label: "Life Orb (+30% dmg)",     allDamageMult: 1.3 };
  if (i === "expert belt")    return { label: "Expert Belt (+20% SE)",    superEffMult: 1.2 };
  if (i === "muscle band")    return { label: "Muscle Band (+10% phys)",  physPowerMult: 1.1 };
  if (i === "wise glasses")   return { label: "Wise Glasses (+10% spec)", specPowerMult: 1.1 };
  if (i === "thick club")     return { label: "Thick Club (×2 Atk)",      atkStatMult: 2.0 };
  if (i === "light ball")     return { label: "Light Ball (×2 Atk/SpA)",  atkStatMult: 2.0, spaStatMult: 2.0 };
  if (i === "soul dew")       return { label: "Soul Dew (+50% SpA)",      spaStatMult: 1.5 };
  const boostType = TYPE_BOOST_ITEMS[i];
  if (boostType) {
    const typeName = boostType.charAt(0).toUpperCase() + boostType.slice(1);
    return { label: `${item} (+20% ${typeName})`, boostType };
  }
  return { label: "" };
}

// ─── Main damage calculation ──────────────────────────────────────────────────

interface CalcInput {
  attacker: CalcPokemon;
  defender: CalcPokemon;
  move: CalcMove;
  weather: WeatherCondition;
  /** True if attacker has been intimidated (−1 Atk stage) */
  attackerIntimidated?: boolean;
  isCrit?: boolean;
  isSingles?: boolean;
  reflect?: boolean;
  lightScreen?: boolean;
  /** Entry hazards on the defender's side: they are counted as if it had just switched in */
  stealthRock?: boolean;
  spikes?: 0 | 1 | 2 | 3;
}

const ROLL_COUNT = 16;
const LOWEST_ROLL = 85;
const noDamage = (): number[] => Array(ROLL_COUNT).fill(0);

/**
 * Returns all 16 damage rolls (random factor 85..100) for the given input,
 * following the Generation IV order of operations:
 *
 *   floor(floor(floor(2·Level/5 + 2) · Power · Atk / 50) / Def)
 *   → burn, Reflect / Light Screen, spread-move penalty, weather   (Mod1)
 *   → + 2 → critical hit → Life Orb (Mod2) → random roll
 *   → STAB → each type's effectiveness → Filter / Expert Belt / Tinted Lens (Mod3)
 *
 * with the result floored after every step. Type-boosting items, Muscle Band,
 * Wise Glasses, Technician and Thick Fat change the base power; Choice items
 * and Huge Power change the attacking stat.
 */
export function calcDamageRolls(input: CalcInput): number[] {
  const { attacker, defender, move, weather, isCrit = false, isSingles = true, reflect = false, lightScreen = false } = input;

  if (move.category === "status" || move.power <= 0) return noDamage();

  const isPhysical = move.category === "physical";
  const moveType = move.type.toLowerCase();
  const defenderTypes = Array.from(defender.types).map((t) => t.toLowerCase());
  const defenderAbility = getAbilityModifiers(defender.ability);
  const attackerAbility = getAbilityModifiers(attacker.ability);

  const typeEff = typeEffectiveness(moveType, defenderTypes);
  if (defenderAbility.isImmune(moveType) || typeEff === 0) return noDamage();
  if (defenderAbility.requiresSuperEffective && typeEff <= 1) return noDamage();

  const itemEff = getItemEffect(attacker.item, attacker.species);

  // Base power
  let power = move.power;
  if (itemEff.boostType === moveType) power = times(power, [6, 5]);
  if (isPhysical && itemEff.physPowerMult) power = times(power, [11, 10]);
  if (!isPhysical && itemEff.specPowerMult) power = times(power, [11, 10]);
  power = times(power, attackerAbility.powerMult(move.power));
  power = times(power, defenderAbility.defenseMult(moveType));

  // Attacking stat. A critical hit ignores the Intimidate drop.
  let atk = isPhysical ? attacker.stats.atk : attacker.stats.spa;
  if (isPhysical && input.attackerIntimidated && !isCrit) atk = times(atk, [2, 3]);
  atk = times(atk, attackerAbility.attackerStatMult(isPhysical, attacker.status !== "none"));
  const statMult = isPhysical ? itemEff.atkStatMult : itemEff.spaStatMult;
  if (statMult) atk = Math.floor(atk * statMult);

  // Defending stat. A sandstorm raises the Sp. Def of Rock types by half.
  let def = isPhysical ? defender.stats.def : defender.stats.spd;
  if (!isPhysical && weather === "sand" && defenderTypes.includes("rock")) def = times(def, [3, 2]);
  def = Math.max(1, def);

  let damage = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * power * atk) / 50) / def);

  // Mod1
  if (isPhysical && attacker.status === "burn" && !attackerAbility.ignoresBurn) damage = times(damage, [1, 2]);
  const screened = !isCrit && (isPhysical ? reflect : lightScreen);
  if (screened) damage = times(damage, isSingles ? [1, 2] : [2, 3]);
  if (!isSingles && move.spread) damage = times(damage, [3, 4]);
  if (weather === "sun" && moveType === "fire") damage = times(damage, [3, 2]);
  if (weather === "sun" && moveType === "water") damage = times(damage, [1, 2]);
  if (weather === "rain" && moveType === "water") damage = times(damage, [3, 2]);
  if (weather === "rain" && moveType === "fire") damage = times(damage, [1, 2]);

  damage += 2;
  if (isCrit) damage *= 2;
  if (itemEff.allDamageMult) damage = times(damage, [13, 10]);

  const hasStab = Array.from(attacker.types).some((t) => t.toLowerCase() === moveType);
  const stab: Ratio = hasStab ? (attackerAbility.stabMult ?? [3, 2]) : ONE;

  return Array.from({ length: ROLL_COUNT }, (_, i) => {
    let roll = times(damage, [LOWEST_ROLL + i, 100]);
    roll = times(roll, stab);
    for (const t of defenderTypes) roll = Math.floor(roll * typeEffectiveness(moveType, [t]));
    // Mod3
    if (typeEff > 1 && defenderAbility.reducesSuperEffective) roll = times(roll, [3, 4]);
    if (typeEff > 1 && itemEff.superEffMult) roll = times(roll, [6, 5]);
    if (typeEff < 1 && attackerAbility.doublesResisted) roll *= 2;
    return Math.max(1, roll);
  });
}

// ─── Entry hazards and weather ────────────────────────────────────────────────

const SPIKES_DIVISOR = [0, 8, 6, 4];
const SAND_IMMUNE_TYPES = ["rock", "ground", "steel"];
const SAND_IMMUNE_ABILITIES = ["sandveil"];
const HAIL_IMMUNE_ABILITIES = ["icebody", "snowcloak"];

/**
 * HP a Pokémon loses on switching in: Stealth Rock takes 1/8 of max HP times its
 * weakness to Rock; Spikes take 1/8, 1/6 or 1/4 unless it is airborne.
 */
export function entryHazardDamage(pokemon: CalcPokemon, hazards: { stealthRock?: boolean; spikes?: number }): number {
  if (getAbilityModifiers(pokemon.ability).ignoresIndirectDamage) return 0;
  const types = Array.from(pokemon.types).map((t) => t.toLowerCase());
  const maxHp = pokemon.stats.hp;
  let lost = 0;
  if (hazards.stealthRock) lost += Math.floor((maxHp * typeEffectiveness("rock", types)) / 8);
  const layers = Math.min(3, Math.max(0, hazards.spikes ?? 0));
  const grounded = !types.includes("flying") && normalize(pokemon.ability) !== "levitate";
  if (layers > 0 && grounded) lost += Math.floor(maxHp / SPIKES_DIVISOR[layers]);
  return lost;
}

/** HP a Pokémon loses at the end of each turn to a sandstorm or hail (1/16 of max HP). */
export function weatherDamage(pokemon: CalcPokemon, weather: WeatherCondition): number {
  if (weather !== "sand" && weather !== "hail") return 0;
  const ability = normalize(pokemon.ability);
  if (ability === "magicguard") return 0;
  const types = Array.from(pokemon.types).map((t) => t.toLowerCase());
  if (weather === "sand" && (types.some((t) => SAND_IMMUNE_TYPES.includes(t)) || SAND_IMMUNE_ABILITIES.includes(ability))) return 0;
  if (weather === "hail" && (types.includes("ice") || HAIL_IMMUNE_ABILITIES.includes(ability))) return 0;
  return Math.floor(pokemon.stats.hp / 16);
}

const percent = (n: number, of: number) => `${Math.round((n / of) * 100)}%`;

/**
 * Full damage result with KO chances. Entry hazards on the defender's side are
 * taken off its HP first, and sandstorm / hail damage is added at the end of
 * each turn it survives.
 */
export function calcDamage(input: CalcInput): DamageResult {
  const rolls = calcDamageRolls(input);
  const maxHp = input.defender.stats.hp;

  const min = Math.min(...rolls);
  const max = Math.max(...rolls);
  const minPercent = maxHp > 0 ? (min / maxHp) * 100 : 0;
  const maxPercent = maxHp > 0 ? (max / maxHp) * 100 : 0;

  const hazardDamage = entryHazardDamage(input.defender, { stealthRock: input.stealthRock, spikes: input.spikes });
  const residual = weatherDamage(input.defender, input.weather);
  const hp = input.defender.currentHp - hazardDamage;

  const ohko = rolls.filter((r) => r >= hp).length;
  // Two hits can roll differently, and the weather takes its share in between
  let twoHitKos = 0;
  for (const first of rolls) for (const second of rolls) if (first + second + residual >= hp) twoHitKos++;
  const pairs = rolls.length * rolls.length;

  let koChance: string;
  if (max === 0) {
    koChance = "No damage";
  } else if (hp <= 0) {
    koChance = "KO from entry hazards";
  } else if (ohko === rolls.length) {
    koChance = "Guaranteed OHKO";
  } else if (ohko > 0) {
    koChance = `${percent(ohko, rolls.length)} chance to OHKO`;
  } else if (twoHitKos === pairs) {
    koChance = "Guaranteed 2HKO";
  } else if (twoHitKos > 0) {
    koChance = `${Math.max(1, Math.round((twoHitKos / pairs) * 100))}% chance to 2HKO`;
  } else if (max * 3 + residual * 2 >= hp) {
    koChance = "Possible 3HKO";
  } else {
    koChance = "Does not KO in 3";
  }

  const extras = [
    hazardDamage > 0 && hp > 0 ? "after entry hazards" : "",
    residual > 0 && ohko < rolls.length && hp > 0 && max > 0 ? `with ${input.weather === "sand" ? "sandstorm" : "hail"} damage` : "",
  ].filter(Boolean);
  if (extras.length > 0) koChance += ` (${extras.join(", ")})`;

  return { min, max, minPercent, maxPercent, koChance, rolls, hazardDamage, residual };
}

// ─── Stat computation helpers ─────────────────────────────────────────────────

type StatKey4 = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

/** Compute final stat from base stat + IV + EV + nature (Gen 4 formula) */
export function computeStat(
  statKey: StatKey4,
  base: number,
  iv: number,
  ev: number,
  nature: string,
  level: number
): number {
  const evBonus = Math.floor(ev / 4);
  if (statKey === "hp") {
    return Math.floor(((2 * base + iv + evBonus) * level) / 100) + level + 10;
  }
  const raw = Math.floor(((2 * base + iv + evBonus) * level) / 100) + 5;
  const natureMods = NATURE_MODS[nature];
  if (!natureMods) return raw;
  if (natureMods.plus === statKey) return Math.floor(raw * 1.1);
  if (natureMods.minus === statKey) return Math.floor(raw * 0.9);
  return raw;
}
