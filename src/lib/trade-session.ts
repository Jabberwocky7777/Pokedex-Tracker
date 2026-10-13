/**
 * A trade session between two sides — two imported saves, two games, or one of
 * each: what each should send the other, as one list.
 *
 *  - Version exclusives: something one side can get that the other side's
 *    game(s) can't give at all.
 *  - Spares: with two saves, a species one side has two or more of and the
 *    other has none.
 *  - Trade evolutions: a Pokémon that only evolves by being traded — send it
 *    over and back.
 *
 * A side that is a save knows what it owns; a side that is just a game doesn't,
 * so for it the list is "everything that game could send". Pure.
 */
import type { GameVersion, Pokemon } from "../types";
import { computeAvailability } from "../hooks/usePokemonFilter";
import { isTradeEvolution } from "./evolution-status";
import { evolutionItem, itemDisplayName } from "./evolution-items";
import { hasNonTradeEncounter } from "./npc-trades";
import type { SlimMon } from "./save/types";

export interface TradeSide {
  /** Stable id for the picker: a profile id, or "game:<version>" */
  key: string;
  label: string;
  games: GameVersion[];
  /** The Pokémon in the save, or null for a side that is only a game */
  mons: SlimMon[] | null;
}

export type TradeKind = "exclusive" | "spare" | "trade-evolution";

export interface TradeItem {
  id: string;
  kind: TradeKind;
  /** Index of the side that sends (0 or 1); the other receives */
  from: 0 | 1;
  species: number;
  /** Trade evolutions: what it becomes, and the item it has to hold */
  evolvesInto?: number;
  heldItem?: string | null;
}

interface Options {
  /** The Pokémon of the sides' generation */
  pokemon: readonly Pokemon[];
  maxSpecies: number;
  /** Caught ids in the tracker — used when a side is only a game, to skip trade evolutions already done */
  caught: ReadonlySet<number>;
}

function owned(side: TradeSide): Map<number, number> | null {
  if (!side.mons) return null;
  const counts = new Map<number, number>();
  for (const mon of side.mons) if (!mon.isEgg) counts.set(mon.species, (counts.get(mon.species) ?? 0) + 1);
  return counts;
}

export function buildTradeSession(sides: readonly [TradeSide, TradeSide], opts: Options): TradeItem[] {
  const pokemon = opts.pokemon.filter((p) => p.id <= opts.maxSpecies);
  const byId = new Map(pokemon.map((p) => [p.id, p]));
  const obtainable = sides.map((side) => computeAvailability([...pokemon], side.games).obtainable);
  const owns = sides.map(owned);
  const items: TradeItem[] = [];

  for (const from of [0, 1] as const) {
    const to = from === 0 ? 1 : 0;
    const have = owns[from], theirs = owns[to];

    // ── Version exclusives ──
    const exclusives = new Set<number>();
    for (const p of pokemon) {
      if (obtainable[to].has(p.id)) continue;                       // the receiver can get it alone
      if (theirs?.has(p.id)) continue;                              // …or already has it
      if (have ? !have.has(p.id) : !hasNonTradeEncounter(p.encounters, sides[from].games)) continue;
      exclusives.add(p.id);
    }
    for (const id of exclusives) {
      // A game-only sender lists each exclusive line once, by its earliest stage: the receiver evolves the rest
      const earlier = byId.get(id)?.evolvesFrom ?? null;
      if (!have && earlier !== null && exclusives.has(earlier)) continue;
      items.push({ id: `exclusive:${from}:${id}`, kind: "exclusive", from, species: id });
    }

    // ── Spares (needs both sides' boxes) ──
    if (have && theirs) {
      for (const [id, count] of have) {
        if (count >= 2 && !theirs.has(id) && !exclusives.has(id) && id <= opts.maxSpecies) {
          items.push({ id: `spare:${from}:${id}`, kind: "spare", from, species: id });
        }
      }
    }

    // ── Trade evolutions ──
    for (const p of pokemon) {
      for (const step of p.evolvesTo) {
        if (!isTradeEvolution(step) || step.speciesId > opts.maxSpecies) continue;
        const wanted = have ? have.has(p.id) && !have.has(step.speciesId)
          // A game-only side: once, from whichever side can get the pre-evolution, unless the tracker has the result
          : !opts.caught.has(step.speciesId) && obtainable[from].has(p.id) && !(from === 1 && !owns[0] && obtainable[0].has(p.id));
        if (!wanted) continue;
        items.push({
          id: `evolve:${from}:${p.id}:${step.speciesId}`, kind: "trade-evolution", from, species: p.id,
          evolvesInto: step.speciesId, heldItem: evolutionItem(step) ? itemDisplayName(evolutionItem(step)!) : null,
        });
      }
    }
  }

  const order: TradeKind[] = ["exclusive", "spare", "trade-evolution"];
  return items.sort((a, b) => a.from - b.from || order.indexOf(a.kind) - order.indexOf(b.kind) || a.species - b.species);
}
