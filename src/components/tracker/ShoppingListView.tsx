import { useMemo } from "react";
import type { Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { EVOLUTION_ITEM_SOURCES, GAME_GROUPS } from "../../data/evolution-items";
import { buildShoppingList, summarizeShoppingList } from "../../lib/evolution-items";
import { generationMaxId, generationVersions } from "../../lib/generation";
import { getGenSprite } from "../../lib/pokemon-display";
import { LocationLink, PokemonLink } from "../shared/links";

interface Props {
  allPokemon: Pokemon[];
  caughtIds: number[];
}

/**
 * Evolution item shopping list: the items needed to evolve what is already
 * caught into what isn't yet, with where to get each in the selected games.
 */
export default function ShoppingListView({ allPokemon, caughtIds }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const activeGames = useSettingsStore((s) => s.activeGames);

  const maxId = generationMaxId(activeGeneration);
  const list = useMemo(
    () => buildShoppingList(allPokemon.filter((p) => p.id <= maxId), new Set(caughtIds), maxId),
    [allPokemon, caughtIds, maxId],
  );

  // Where to look: the selected games, or all of the generation's
  const games = activeGames.length > 0 ? activeGames : generationVersions(activeGeneration);
  const groups = GAME_GROUPS
    .map((group) => ({ ...group, games: group.games.filter((g) => games.includes(g)) }))
    .filter((group) => group.games.length > 0);

  return (
    <div className="p-4 flex flex-col gap-3 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>
          Evolution items
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          What you need to evolve the Pokémon you have caught into the ones you haven&apos;t.
          Where to find them is taken from Bulbapedia's item pages, for {games.map((g) => GAME_LABELS[g]).join(", ")}.
        </p>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-6 text-center">
          Nothing to buy: none of your caught Pokémon has an uncaught evolution that needs an item.
        </p>
      ) : (
        <p className="text-sm text-gray-200 px-3 py-2 rounded-lg bg-indigo-900/30 border border-indigo-700/50" data-testid="shopping-summary">
          {summarizeShoppingList(list)}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {list.map((need) => {
          const sources = EVOLUTION_ITEM_SOURCES[need.item] ?? {};
          return (
            <li key={need.item} className="rounded-xl bg-gray-900 border border-gray-800 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="min-w-[2rem] px-2 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-bold text-center tabular-nums">
                  {need.count}
                </span>
                <span className="text-sm font-semibold text-gray-100">{need.name}</span>
                {need.uses.some((u) => u.trade) && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-200 border border-blue-700/50">
                    HELD IN A TRADE
                  </span>
                )}
              </div>

              {/* Who it is for */}
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {need.uses.map(({ from, step, condition }) => (
                  <li key={`${from.id}-${step.speciesId}`} className="flex items-center gap-1.5 text-sm text-gray-300">
                    <img src={getGenSprite(from, activeGeneration)} alt="" loading="lazy" className="w-7 h-7 object-contain" style={{ imageRendering: "pixelated" }} />
                    <span>
                      <PokemonLink id={from.id} to="tracker">{from.displayName}</PokemonLink>
                      {" → "}
                      <PokemonLink id={step.speciesId} to="tracker">{step.displayName}</PokemonLink>
                      {condition && <span className="text-xs text-gray-500"> ({condition})</span>}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Where to get it */}
              <div className="flex flex-col gap-1 text-xs">
                {groups.map((group) => {
                  const places = sources[group.id];
                  return (
                    <div key={group.id} className="flex gap-2">
                      <span className="w-40 flex-shrink-0 text-gray-500">{group.games.map((g) => GAME_LABELS[g]).join(" / ")}</span>
                      {places ? (
                        <ul className="flex flex-col gap-0.5 text-gray-300 min-w-0">
                          {places.map((place) => (
                            <li key={place}><LocationLink text={place} games={group.games} allPokemon={allPokemon} /></li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-600">Not found in these games — trade it over</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
