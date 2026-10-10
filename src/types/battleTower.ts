// Types for Battle Tower trainer lookup and damage calculator data

export interface BattleTowerSet {
  id: number;
  species: string;
  setNumber: number;
  nature: string;
  item: string;
  moves: [string, string, string, string];
  evSpread: string;
  stats: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
}

export interface TrainerEntry {
  class: string;
  gender: "M" | "F" | null;
  name: string;
}

export interface PoolEntry {
  species: string;
  sets: number[]; // e.g. [1,2,3,4] or [4]
}

export interface TrainerCategory {
  id: string;
  description: string;
  ivTier: number;
  game: "platinum" | "hgss" | "both";
  round: "open" | "super" | "both";
  /** HGSS only: which tiers (1–8) this trainer group appears in. */
  hgssTier?: number[];
  pokemonPool: PoolEntry[];
  trainers: TrainerEntry[];
}

// ─── Damage Calculator types ──────────────────────────────────────────────────

export type WeatherCondition = "none" | "sun" | "rain" | "sand" | "hail";
export type StatusCondition = "none" | "burn" | "paralysis" | "poison" | "toxic" | "freeze" | "sleep";
export type MoveCategory = "physical" | "special" | "status";

export interface CalcMove {
  name: string;
  power: number;
  type: string;
  category: MoveCategory;
  priority?: number;
  makesContact?: boolean;
  /** Hits more than one Pokémon, so it does 3/4 damage in a Double Battle */
  spread?: boolean;
  /** The name was looked up and isn't a move the app knows */
  notFound?: boolean;
}

export interface CalcStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface CalcPokemon {
  source: "designer" | "tower-set" | "custom";
  species: string;
  types: [string] | [string, string];
  level: number;
  nature: string;
  ability: string;
  item: string;
  status: StatusCondition;
  stats: CalcStats;
  moves: CalcMove[];
  currentHp: number; // 0..stats.hp
}

export interface DamageResult {
  min: number;
  max: number;
  minPercent: number;
  maxPercent: number;
  /** "Guaranteed OHKO", "Guaranteed 2HKO", "~X% chance OHKO", etc. */
  koChance: string;
  rolls: number[];
  /** HP the defender loses to Stealth Rock and Spikes before the hit */
  hazardDamage: number;
  /** HP the defender loses to sandstorm or hail at the end of each turn */
  residual: number;
}
