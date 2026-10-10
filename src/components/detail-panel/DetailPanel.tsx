import LocationTable from "./LocationTable";
import EvolutionBadge from "./EvolutionBadge";
import type { Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import type { GameVersion } from "../../types";
import { splitNpcTrades } from "../../lib/npc-trades";
import { uncaughtEvolutions, isTradeEvolution, describeEvolution } from "../../lib/evolution-status";
import { TYPE_COLORS } from "../../lib/type-colors";
import { getGenSprite, getGenShinySprite, formatDexNumber } from "../../lib/pokemon-display";
import TypeBadge from "../shared/TypeBadge";
import { useSettingsStore } from "../../store/useSettingsStore";
import { generationMaxId, generationVersions } from "../../lib/generation";
import InYourSaves from "../saves/InYourSaves";
import type { SavesOverview } from "../../hooks/useSaves";

interface Props {
  pokemon: Pokemon;
  allPokemonMap: Map<number, Pokemon>;
  isCaught: boolean;
  isPending: boolean;
  isShiny: boolean;
  /** In its own slot in the living dex */
  isPlaced?: boolean;
  /** What the imported game saves say (null when none are imported for this generation) */
  savesOverview?: SavesOverview | null;
  /** Caught ids for the active generation — used for the evolution reminder. */
  caughtIds?: ReadonlySet<number>;
  /** Highest National Dex number in the active generation. */
  genMaxId?: number;
  onToggleCaught: () => void;
  onTogglePending: () => void;
  onToggleShiny: () => void;
  onTogglePlaced?: () => void;
  onClose: () => void;
  /** Which of the currently-selected games have this Pokémon. Non-empty only when exclusive. */
  exclusiveGames?: string[];
  onRouteClick?: (slug: string) => void;
  onPokedexClick?: () => void;
}

export default function DetailPanel({ pokemon, allPokemonMap, isCaught, isPending, isShiny, isPlaced = false, savesOverview = null, caughtIds, genMaxId: genMaxIdProp, onToggleCaught, onTogglePending, onToggleShiny, onTogglePlaced, onClose, exclusiveGames = [], onRouteClick, onPokedexClick }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const {
    id, displayName, types,
    isLegendary, isMythical, isBaby, hasStaticEncounter,
    encounters, evolvesTo, evolvesFrom,
  } = pokemon;
  const genMaxId = genMaxIdProp ?? generationMaxId(activeGeneration);

  const sprite = isShiny ? getGenShinySprite(pokemon, activeGeneration) : getGenSprite(pokemon, activeGeneration);
  const primaryType = types[0];
  const typeGradient = TYPE_COLORS[primaryType] ?? "#374151";
  // Only what exists in the active generation: Magneton has no evolution in Gen III
  const canEvolve = evolvesTo.some((step) => step.speciesId <= genMaxId);
  const preEvolution = evolvesFrom !== null && evolvesFrom <= genMaxId ? evolvesFrom : null;
  // Caught, but an evolution isn't yet — same test the "Needs attention" filter uses
  const evolutionsToDo = isCaught && caughtIds ? uncaughtEvolutions(pokemon, caughtIds, genMaxId) : [];

  // Filter encounters to only show games from the active generation
  const genVersions = generationVersions(activeGeneration);
  // NPC in-game trades are encounter rows with method "trade"; show them as their
  // own cards rather than in the location table.
  const { wild: filteredEncounters, trades: npcTrades } = splitNpcTrades(
    encounters.filter((e) => genVersions.includes(e.version as typeof genVersions[number])),
    displayName,
  );

  // For breed-only babies (isBaby, no encounters, base form): the breed parent is evolvesTo[0]
  const breedParentName =
    isBaby && filteredEncounters.length === 0 && evolvesTo.length > 0
      ? evolvesTo[0].displayName
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header with gradient background */}
      <div
        className="relative p-4 flex flex-col items-center"
        style={{
          background: `linear-gradient(135deg, ${typeGradient}22 0%, transparent 100%)`,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Shiny toggle — top-left of header, mirrors close button */}
        <button
          onClick={onToggleShiny}
          title={isShiny ? "Shiny — click to unmark" : "Mark as shiny"}
          className={`absolute top-3 left-3 text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
            isShiny
              ? "bg-yellow-400/20 text-yellow-300 ring-1 ring-yellow-400/40"
              : "bg-gray-700/80 text-gray-500 hover:text-gray-300"
          }`}
        >
          ✦
        </button>

        {/* Sprite */}
        <div className="relative">
          <img
            src={sprite}
            alt={displayName}
            className="w-24 h-24 object-contain drop-shadow-lg"
            style={{ imageRendering: "pixelated" }}
          />
          {isPlaced && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-gray-900 text-xs text-gray-900" title="Placed in your living dex">
              ★
            </div>
          )}
          {isCaught && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-900">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {isPending && !isCaught && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-gray-900" title="Pending evolution">
              <svg className="w-3.5 h-3.5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Name + number */}
        <div className="mt-2 text-center">
          <div className="text-xs text-gray-500 font-mono">#{formatDexNumber(id)}</div>
          <h2 className="text-xl font-bold text-white mt-0.5">{displayName}</h2>
        </div>

        {/* Types */}
        <div className="flex gap-2 mt-2">
          {types.map((t) => <TypeBadge key={t} type={t} />)}
        </div>

        {/* Status badges */}
        <div className="flex gap-2 mt-2 flex-wrap justify-center">
          {isLegendary && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700/50">
              ◆ Legendary
            </span>
          )}
          {isMythical && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-700/50">
              ✦ Mythical
            </span>
          )}
          {isBaby && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-900/50 text-pink-300 border border-pink-700/50">
              ♡ Baby
            </span>
          )}
          {hasStaticEncounter && !isLegendary && !isMythical && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-900/50 text-orange-300 border border-orange-700/50">
              ! One-time
            </span>
          )}
          {exclusiveGames.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50"
              title={`Only catchable in ${exclusiveGames.map((g) => GAME_LABELS[g as GameVersion] ?? g).join(" & ")} among your selected games`}
            >
              ★ {exclusiveGames.map((g) => GAME_LABELS[g as GameVersion] ?? g).join(" & ")} only
            </span>
          )}
          {canEvolve && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-900/50 text-teal-300 border border-teal-700/50">
              ↑ Evolves
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-2 border-b border-gray-800 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={onToggleCaught}
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
              isCaught
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            {isCaught ? "✓ Caught" : "Mark as Caught"}
          </button>
          <button
            onClick={onTogglePending}
            title="Have the pre-evolution and need to evolve to fill this slot"
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
              isPending && !isCaught
                ? "bg-yellow-500 hover:bg-yellow-600 text-gray-900"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            {isPending && !isCaught ? "⏱ Pending" : "Mark Pending"}
          </button>
        </div>
        {onTogglePlaced && (
          <button
            onClick={onTogglePlaced}
            title="It sits in its own slot in your living dex"
            className={`w-full py-1.5 rounded-lg font-medium text-sm transition-all border ${
              isPlaced
                ? "bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border-amber-400/50"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200 border-transparent"
            }`}
          >
            {isPlaced ? "★ Placed in living dex" : "★ Mark placed in living dex"}
          </button>
        )}
        {onPokedexClick && (
          <button
            onClick={onPokedexClick}
            className="w-full py-1.5 rounded-lg font-medium text-sm transition-all bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-300 border border-indigo-700/50"
          >
            📖 More Detail
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {/* Evolution reminder: this one is caught, a next stage isn't */}
        {evolutionsToDo.length > 0 && (
          <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-teal-900/20 border border-teal-700/30">
            <div className="text-xs text-teal-300 font-medium uppercase tracking-wider">Next: evolve it</div>
            {evolutionsToDo.map((step) => (
              <div key={step.speciesId} className="flex items-start gap-2 text-sm text-gray-200">
                <span className={isTradeEvolution(step) ? "text-blue-300" : "text-teal-400"}>
                  {isTradeEvolution(step) ? "⇄" : "↑"}
                </span>
                <span>
                  {describeEvolution(displayName, step)}
                  {isTradeEvolution(step) && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-200 border border-blue-700/50 align-middle">
                      TRADE
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        {savesOverview && (
          <InYourSaves pokemon={pokemon} pokemonMap={allPokemonMap} overview={savesOverview} />
        )}
        {/* Evolution chain */}
        {(canEvolve || preEvolution !== null) && (
          <EvolutionBadge pokemon={pokemon} allPokemon={allPokemonMap} maxId={genMaxId} />
        )}

        {/* Location data */}
        <div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
            Where to Find
          </div>
          <LocationTable
            encounters={filteredEncounters}
            evolvesFrom={preEvolution}
            evolvesFromName={preEvolution ? (allPokemonMap.get(preEvolution)?.displayName ?? null) : null}
            evolvesFromDetails={
              preEvolution
                ? (allPokemonMap.get(preEvolution)?.evolvesTo.find(
                    (s) => s.speciesId === pokemon.id
                  )?.details ?? null)
                : null
            }
            npcTrades={npcTrades}
            breedParentName={breedParentName}
            onRouteClick={onRouteClick}
          />
        </div>
      </div>
    </div>
  );
}
