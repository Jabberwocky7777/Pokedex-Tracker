import type { StatKey } from "../iv-calc";

/** Which save layout a file uses. Diamond/Pearl and HeartGold/SoulSilver share one each. */
export type SaveFamily = "dp" | "platinum" | "hgss";

/** Tracker generation bucket that Gen IV saves update. */
export const SAVE_GEN = 4;
export const MAX_SPECIES_GEN4 = 493;
export const BOX_COUNT = 18;
export const BOX_SIZE = 30;
/** `box` value used for Pokémon in the party. */
export const PARTY_BOX = -1;

/**
 * living-dex: the save whose boxes are the user's National Dex, one species per slot.
 * playthrough: any other save — its Pokémon count as owned but never as "placed".
 */
export type SaveRole = "living-dex" | "playthrough";

export class SaveParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveParseError";
  }
}

/** What the synced summary keeps for each Pokémon — enough for the living-dex grid. */
export interface SlimMon {
  /** 0-based box, or PARTY_BOX */
  box: number;
  /** 0-based slot within the box or party */
  slot: number;
  species: number;
  form: number;
  shiny: boolean;
  level: number;
  isEgg: boolean;
}

export type Gender = "male" | "female" | "genderless";

/** One fully decoded Pokémon. Lives only on the device that imported the save. */
export interface SaveMon extends SlimMon {
  pid: number;
  nickname: string;
  isNicknamed: boolean;
  /** The nickname or OT name is in a script the decoder doesn't cover (Japanese / Korean carts). */
  nameUnsupported: boolean;
  heldItem: number;
  otName: string;
  otTid: number;
  otSid: number;
  otFemale: boolean;
  exp: number;
  friendship: number;
  ability: number;
  evs: Record<StatKey, number>;
  ivs: Record<StatKey, number>;
  moves: number[];
  pp: number[];
  ppUps: number[];
  /** Index into NATURES (iv-calc.ts) */
  nature: number;
  gender: Gender;
  fateful: boolean;
  originGame: number;
  metLocation: number;
  metLevel: number;
  /** [year, month, day] — year is the full year */
  metDate: [number, number, number] | null;
  ball: number;
  pokerus: number;
}

export interface SaveTrainer {
  name: string;
  tid: number;
  sid: number;
}

export interface ParsedSave {
  family: SaveFamily;
  /** Best guess at the exact game ("Diamond" vs "Pearl" isn't stored in the save). */
  game: string;
  trainer: SaveTrainer;
  /** The general block's save counter — higher means a more recent save. */
  saveCount: number;
  boxNames: string[];
  /** Every occupied slot, party first. Eggs are included and flagged. */
  mons: SaveMon[];
  warnings: string[];
}

/** Per-profile metadata — small enough for localStorage, and synced. */
export interface SaveProfile {
  /** `${family}-${tid}-${sid}` */
  id: string;
  label: string;
  role: SaveRole;
  /** 0-based box where National Dex #001 lives (living-dex saves) */
  startBox: number;
  fileName: string;
  /** epoch ms */
  importedAt: number;
  saveCount: number;
  family: SaveFamily;
  trainer: SaveTrainer;
}

/** [box, slot, species, form, shiny 0|1, level, isEgg 0|1] */
export type SummaryTuple = [number, number, number, number, number, number, number];

/** The slim, synced view of a save: what other devices get instead of the file. */
export interface SaveSummary {
  boxNames: string[];
  mons: SummaryTuple[];
}

/** A profile together with its Pokémon — the input to living-dex and import planning. */
export interface ProfileMons {
  profile: SaveProfile;
  boxNames: string[];
  mons: SlimMon[];
}

/** The few species facts the save logic needs; `Pokemon` from pokemon.json satisfies it. */
export interface SpeciesInfo {
  id: number;
  displayName: string;
  isBaby: boolean;
  evolvesFrom: number | null;
  evolvesTo: { speciesId: number }[];
}

export type SpeciesMap = ReadonlyMap<number, SpeciesInfo>;
