/**
 * The evolution item shopping list: for every uncaught evolution of a Pokémon
 * that is caught, the item it needs — grouped by item, with a count.
 */
import type { EvolutionStep, Pokemon } from "../types";
import { EVOLUTION_ITEM_NAMES } from "../data/evolution-items";
import { isTradeEvolution, uncaughtEvolutions } from "./evolution-status";

/** The item an evolution uses up, as the data spells it ("Dawn Stone", "Kings Rock"), or null when it needs none. */
export function evolutionItem(step: EvolutionStep): string | null {
  if (step.trigger === "use-item") return step.details;
  // "Trade holding Metal Coat", "Level up holding Razor Claw (night)"
  return step.details.match(/holding (.+?)(?: \(|$)/i)?.[1] ?? null;
}

export const itemDisplayName = (item: string): string => EVOLUTION_ITEM_NAMES[item] ?? item;

export interface ItemUse {
  from: Pokemon;
  step: EvolutionStep;
  /** The item is held during a trade, so another player (or a second game) is needed */
  trade: boolean;
  /** Anything else the evolution asks for: "night", "day" */
  condition: string | null;
}

export interface ItemNeed {
  item: string;
  name: string;
  count: number;
  /** Every use of this item is a trade evolution */
  trade: boolean;
  uses: ItemUse[];
}

/**
 * @param pokemon the Pokémon of the active generation
 * @param caught  caught ids for that generation
 * @param maxId   highest dex number in that generation — later evolutions are left out
 */
export function buildShoppingList(pokemon: readonly Pokemon[], caught: ReadonlySet<number>, maxId: number): ItemNeed[] {
  const byItem = new Map<string, ItemUse[]>();
  for (const from of pokemon) {
    if (!caught.has(from.id)) continue;
    for (const step of uncaughtEvolutions(from, caught, maxId)) {
      const item = evolutionItem(step);
      if (!item) continue;
      const condition = step.trigger === "use-item" ? null : step.details.match(/\(([^)]+)\)\s*$/)?.[1] ?? null;
      byItem.set(item, [...(byItem.get(item) ?? []), { from, step, trade: isTradeEvolution(step), condition }]);
    }
  }
  return Array.from(byItem, ([item, uses]) => ({
    item, name: itemDisplayName(item), count: uses.length, trade: uses.every((u) => u.trade),
    uses: uses.sort((a, b) => a.from.id - b.from.id),
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const plural = (name: string, count: number) => (count === 1 ? name : /s$/i.test(name) ? name : `${name}s`);

/** "2 Dawn Stones, 1 Razor Claw, 1 Metal Coat (trade)" */
export function summarizeShoppingList(list: readonly ItemNeed[]): string {
  return list.map((need) => `${need.count} ${plural(need.name, need.count)}${need.trade ? " (trade)" : ""}`).join(", ");
}
