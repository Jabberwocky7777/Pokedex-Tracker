/**
 * Box search: find individual Pokémon across every imported save.
 * Same style as the tracker search (lib/pokemon-search.ts): terms are
 * separated by spaces and must all match.
 *
 *   garchomp          species name or nickname contains "garchomp"
 *   445  #445         National Dex number
 *   shiny  egg        flags (also shiny:no, egg:no)
 *   nature:adamant    ability:levitate · item:leftovers · move:earthquake · ot:brendan · game:diamond
 *   spe:31            an IV — hp, atk, def, spa, spd, spe — with : = > >= < <= or a range (atk:28-31)
 *   ivtotal>=150      perfect>=4 (number of 31s) · evtotal>=500 · level>=50 · lv:10-20
 *
 * Use a hyphen or underscore for values with a space: move:ancient-power.
 * Name, number, shiny, egg and level work from the synced summary; everything
 * else needs the full save, which only the importing device has.
 */
import type { StatKey } from "../iv-calc";
import { NATURES } from "../iv-calc";
import { abilityName, heldItemName, moveName, originGameName } from "./tables";
import type { ProfileMons, SaveMon, SlimMon } from "./types";

export const MON_SEARCH_PLACEHOLDER = "garchomp, shiny, nature:adamant, spe:31, ivtotal>=150…";
export const MON_SEARCH_HELP =
  "Name or dex number · shiny · egg · nature: ability: item: move: ot: game: · IVs like spe:31 or atk>=28 · ivtotal>=150 · perfect>=4 · evtotal>=500 · level>=50 (ranges: lv:10-20). Combine with spaces.";

type TextField = "nature" | "ability" | "item" | "move" | "ot" | "game";
type NumberField = StatKey | "ivtotal" | "perfect" | "evtotal" | "level";
type Op = "=" | ">" | ">=" | "<" | "<=" | "range";

export type MonTerm =
  | { kind: "name"; value: string }
  | { kind: "dex"; value: number }
  | { kind: "flag"; field: "shiny" | "egg"; value: boolean }
  | { kind: "text"; field: TextField; value: string }
  | { kind: "number"; field: NumberField; op: Op; a: number; b: number };

const TEXT_FIELDS: Record<string, TextField> = {
  nature: "nature", ability: "ability", item: "item", held: "item", move: "move", ot: "ot", trainer: "ot", game: "game", origin: "game",
};
const NUMBER_FIELDS: Record<string, NumberField> = {
  hp: "hp", atk: "atk", attack: "atk", def: "def", defense: "def",
  spa: "spAtk", spatk: "spAtk", spd: "spDef", spdef: "spDef", spe: "spe", speed: "spe",
  ivtotal: "ivtotal", ivs: "ivtotal", perfect: "perfect", evtotal: "evtotal", evs: "evtotal",
  level: "level", lv: "level", lvl: "level",
};
const YES = new Set(["yes", "y", "true", "1"]);
const NO = new Set(["no", "n", "false", "0"]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseMonSearch(query: string): MonTerm[] {
  const terms: MonTerm[] = [];
  for (const token of query.trim().toLowerCase().split(/\s+/)) {
    if (!token) continue;

    const flag = token.match(/^(shiny|egg|eggs)(?::(.+))?$/);
    if (flag && (flag[2] === undefined || YES.has(flag[2]) || NO.has(flag[2]))) {
      terms.push({ kind: "flag", field: flag[1] === "shiny" ? "shiny" : "egg", value: flag[2] === undefined || YES.has(flag[2]) });
      continue;
    }

    const field = token.match(/^([a-z]+)(>=|<=|>|<|:|=)(.+)$/);
    if (field) {
      const [, key, symbol, value] = field;
      const numberField = NUMBER_FIELDS[key];
      const range = value.match(/^(\d+)-(\d+)$/);
      if (numberField && (range || /^\d+$/.test(value))) {
        const a = parseInt(range ? range[1] : value, 10);
        const b = range ? parseInt(range[2], 10) : a;
        const op: Op = range ? "range" : symbol === ":" ? "=" : (symbol as Op);
        terms.push({ kind: "number", field: numberField, op, a: Math.min(a, b), b: Math.max(a, b) });
        continue;
      }
      if (TEXT_FIELDS[key] && (symbol === ":" || symbol === "=") && norm(value)) {
        terms.push({ kind: "text", field: TEXT_FIELDS[key], value: norm(value) });
        continue;
      }
    }

    const dex = token.match(/^#?(\d+)$/);
    if (dex) {
      terms.push({ kind: "dex", value: parseInt(dex[1], 10) });
      continue;
    }
    if (norm(token)) terms.push({ kind: "name", value: norm(token) });
  }
  return terms;
}

/** True when a term can only be answered from a fully parsed save. */
export function needsFullSave(terms: MonTerm[]): boolean {
  return terms.some((t) => t.kind === "text" || (t.kind === "number" && t.field !== "level"));
}

export interface SearchEntry {
  profile: ProfileMons;
  mon: SlimMon;
  full?: SaveMon;
  /** Species display name */
  speciesName: string;
}

const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spAtk", "spDef", "spe"];

function numberOf(entry: SearchEntry, field: NumberField): number | null {
  const { mon, full } = entry;
  if (field === "level") return mon.level;
  if (!full) return null;
  if (field === "ivtotal") return STAT_KEYS.reduce((sum, k) => sum + full.ivs[k], 0);
  if (field === "perfect") return STAT_KEYS.filter((k) => full.ivs[k] === 31).length;
  if (field === "evtotal") return STAT_KEYS.reduce((sum, k) => sum + full.evs[k], 0);
  return full.ivs[field];
}

function textOf(full: SaveMon, field: TextField): string[] {
  switch (field) {
    case "nature": return [NATURES[full.nature]?.name ?? ""];
    case "ability": return [abilityName(full.ability)];
    case "item": return full.heldItem > 0 ? [heldItemName(full)] : [];
    case "move": return full.moves.filter((id) => id > 0).map(moveName);
    case "ot": return [full.otName];
    case "game": return [originGameName(full.originGame)];
  }
}

export function matchesMon(entry: SearchEntry, terms: MonTerm[]): boolean {
  const { mon, full } = entry;
  return terms.every((term) => {
    switch (term.kind) {
      case "name":
        // An egg is found by "egg", not by the species inside it
        return !mon.isEgg && (norm(entry.speciesName).includes(term.value) || (!!full?.isNicknamed && norm(full.nickname).includes(term.value)));
      case "dex":
        return !mon.isEgg && mon.species === term.value;
      case "flag":
        return term.field === "egg" ? mon.isEgg === term.value : !mon.isEgg && mon.shiny === term.value;
      case "text":
        return !!full && !mon.isEgg && textOf(full, term.field).some((value) => norm(value).includes(term.value));
      case "number": {
        const n = mon.isEgg ? null : numberOf(entry, term.field);
        if (n === null) return false;
        switch (term.op) {
          case "=": return n === term.a;
          case ">": return n > term.a;
          case ">=": return n >= term.a;
          case "<": return n < term.a;
          case "<=": return n <= term.a;
          case "range": return n >= term.a && n <= term.b;
        }
      }
    }
  });
}
