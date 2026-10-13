import { useMemo, useState } from "react";
import type { Pokemon } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import { markHuntFound, startHunt, updateHunt, useHuntStore, type ShinyHunt } from "../../store/useHuntStore";
import { liveEntries } from "../../lib/entries";
import { toggleWithUndo } from "../../lib/dex-actions";
import { chanceByNow, formatChance, formatOdds, methodInfo, methodsFor, oddsPerEncounter, RADAR_MAX_CHAIN, type HuntMethod } from "../../lib/shiny-odds";
import { getGenShinySprite } from "../../lib/pokemon-display";
import PokemonPicker from "../shared/PokemonPicker";
import { PokemonLink } from "../shared/links";

interface Props {
  allPokemon: Pokemon[];
}

/**
 * Shiny hunt counter: one card per hunt with big +1 / −1 buttons, the odds for
 * its method, and "Found it", which marks the Pokémon shiny in the tracker.
 * Hunts sync; a count changed on two devices keeps the later one.
 */
export default function ShinyHuntView({ allPokemon }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const entries = useHuntStore((s) => s.entries);
  const remove = useHuntStore((s) => s.remove);
  const shinyIds = useDexStore((s) => s.shinyByGen[activeGeneration]);
  const [picking, setPicking] = useState(false);
  const [method, setMethod] = useState<HuntMethod>("random");

  const byId = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);
  const hunts = useMemo(
    () => liveEntries(entries).filter(([, hunt]) => hunt.generation === activeGeneration).sort((a, b) => b[1].startedAt - a[1].startedAt),
    [entries, activeGeneration],
  );
  const active = hunts.filter(([, hunt]) => hunt.foundAt === undefined);
  const found = hunts.filter(([, hunt]) => hunt.foundAt !== undefined);
  const methods = methodsFor(activeGeneration);
  const chosen = methods.some((m) => m.id === method) ? method : methods[0].id;

  function start(pokemonId: number) {
    startHunt(activeGeneration, pokemonId, chosen);
    setPicking(false);
  }

  const save = (id: string, _hunt: ShinyHunt, patch: Partial<ShinyHunt>) => updateHunt(id, patch);

  function foundIt(id: string, hunt: ShinyHunt, pokemon: Pokemon) {
    markHuntFound(id);
    // Through dex-actions, like every mark: undo toast, change log, sync
    if (!(shinyIds ?? []).includes(pokemon.id)) toggleWithUndo("shiny", pokemon.id, hunt.generation, pokemon.displayName);
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-3xl" data-testid="shiny-hunts">
      <div>
        <h2 className="text-base font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>
          Shiny hunts
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Count encounters, resets or eggs, and see the odds for the method. Finding it marks the Pokémon shiny in the tracker.
        </p>
      </div>

      {/* New hunt */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900 border border-gray-800">
        <label className="flex items-center gap-2 text-xs text-gray-400 flex-1 min-w-[12rem]">
          Method
          <select
            value={chosen}
            onChange={(e) => setMethod(e.target.value as HuntMethod)}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          >
            {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <button
          onClick={() => setPicking(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors"
        >
          Start a hunt…
        </button>
        <p className="basis-full text-xs text-gray-500">{methodInfo(chosen).note}</p>
      </div>

      {active.length === 0 && <p className="text-sm text-gray-400 italic">No hunt in progress.</p>}

      <ul className="flex flex-col gap-3">
        {active.map(([id, hunt]) => {
          const pokemon = byId.get(hunt.pokemonId);
          if (!pokemon) return null;
          const info = methodInfo(hunt.method);
          const odds = oddsPerEncounter(hunt.method, hunt.count);
          const chance = chanceByNow(hunt.method, hunt.count);
          return (
            <li key={id} className="rounded-xl bg-gray-900 border border-gray-800 p-3 flex flex-col gap-3" data-testid="hunt-card">
              <div className="flex items-center gap-3">
                <img src={getGenShinySprite(pokemon, hunt.generation)} alt="" className="w-14 h-14 object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />
                <div className="min-w-0 flex-1">
                  <PokemonLink id={pokemon.id} to="tracker" generation={hunt.generation} className="text-sm font-semibold text-gray-100">
                    {pokemon.displayName}
                  </PokemonLink>
                  <div className="text-xs text-gray-400">{info.label}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white tabular-nums leading-none" data-testid="hunt-count">{hunt.count.toLocaleString("en-US")}</div>
                  <div className="text-[11px] text-gray-500">{hunt.method === "radar" ? "chain" : `${info.unit}${hunt.count === 1 ? "" : "s"}`}</div>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button
                  onClick={() => save(id, hunt, { count: Math.max(0, hunt.count - 1) })}
                  disabled={hunt.count === 0}
                  aria-label={`One fewer for ${pokemon.displayName}`}
                  className="h-16 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-2xl font-bold text-gray-200 transition-colors disabled:opacity-40"
                >
                  −1
                </button>
                <button
                  onClick={() => save(id, hunt, { count: hunt.count + 1 })}
                  aria-label={`One more for ${pokemon.displayName}`}
                  className="h-16 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-400 text-2xl font-bold text-white transition-colors"
                >
                  +1
                </button>
              </div>

              <div className="text-xs text-gray-300" data-testid="hunt-odds">
                {hunt.method === "radar" ? (
                  <>
                    <span className="font-semibold text-gray-100">{formatOdds(odds)}</span> for each shaking patch at a chain of {Math.min(hunt.count, RADAR_MAX_CHAIN)}
                    {hunt.count >= RADAR_MAX_CHAIN ? " — the best it gets. Stop moving and reset the radar." : "."}
                    {hunt.count > 0 && (
                      <button onClick={() => save(id, hunt, { count: 0 })} className="ml-2 text-indigo-300 hover:text-indigo-200 underline decoration-dotted">
                        The chain broke
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-gray-100">{formatOdds(odds)}</span> each
                    {chance !== null && <> · {formatChance(chance)} chance to have seen one by now</>}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => foundIt(id, hunt, pokemon)}
                  className="flex-1 py-2 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30 border border-yellow-400/40 text-sm text-yellow-200 font-medium transition-colors"
                >
                  ✦ Found it
                </button>
                <button
                  onClick={() => remove(id)}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-300 font-medium transition-colors"
                >
                  Give up
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {found.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs text-gray-500 font-medium uppercase tracking-wider">Found</h3>
          <ul className="flex flex-col gap-1">
            {found.map(([id, hunt]) => {
              const pokemon = byId.get(hunt.pokemonId);
              if (!pokemon) return null;
              return (
                <li key={id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-sm" data-testid="hunt-found">
                  <span className="text-yellow-300">✦</span>
                  <PokemonLink id={pokemon.id} to="tracker" generation={hunt.generation} className="text-gray-100">{pokemon.displayName}</PokemonLink>
                  <span className="text-xs text-gray-400">
                    {methodInfo(hunt.method).label} · {hunt.method === "radar" ? `chain of ${hunt.count}` : `after ${hunt.count.toLocaleString("en-US")}`}
                  </span>
                  <span className="ml-auto text-xs text-gray-500 whitespace-nowrap">{new Date(hunt.foundAt!).toLocaleDateString()}</span>
                  <button onClick={() => remove(id)} aria-label={`Remove the ${pokemon.displayName} hunt`} className="text-gray-600 hover:text-red-400">✕</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {picking && (
        <PokemonPicker
          allPokemon={allPokemon}
          activeGeneration={activeGeneration}
          onSelect={start}
          onClose={() => setPicking(false)}
          title="Hunt which Pokémon?"
        />
      )}
    </div>
  );
}
