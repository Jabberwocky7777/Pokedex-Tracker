import LocationTable from "./LocationTable";
import EvolutionBadge from "./EvolutionBadge";
import type { Pokemon } from "../../types";
import { GAME_LABELS, GEN3_VERSIONS, GEN4_VERSIONS } from "../../types";
import type { GameVersion } from "../../types";
import npcTradesRaw from "../../data/npc-trades.json";
import { TYPE_COLORS } from "../../lib/type-colors";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import TypeBadge from "../shared/TypeBadge";
import { useSettingsStore } from "../../store/useSettingsStore";

interface NpcTradeEntry {
  pokemonId: number;
  games: string[];
  note: string;
}
const allNpcTrades = npcTradesRaw as NpcTradeEntry[];

interface Props {
  pokemon: Pokemon;
  allPokemonMap: Map<number, Pokemon>;
  isCaught: boolean;
  isPending: boolean;
  onToggleCaught: () => void;
  onTogglePending: () => void;
  onClose: () => void;
  /** Which of the currently-selected games have this Pokémon. Non-empty only when exclusive. */
  exclusiveGames?: string[];
  onRouteClick?: (slug: string) => void;
  onPokedexClick?: () => void;
}

export default function DetailPanel({ pokemon, allPokemonMap, isCaught, isPending, onToggleCaught, onTogglePending, onClose, exclusiveGames = [], onRouteClick, onPokedexClick }: Props) {
  const { activeGeneration } = useSettingsStore();
  const {
    id, displayName, types,
    isLegendary, isMythical, isBaby, hasStaticEncounter,
    encounters, evolvesTo, evolvesFrom,
  } = pokemon;

  const sprite = getGenSprite(pokemon, activeGeneration);
  const primaryType = types[0];
  const typeGradient = TYPE_COLORS[primaryType] ?? "#374151";
  const canEvolve = evolvesTo.length > 0;

  // Filter encounters to only show games from the active generation
  const genVersions: GameVersion[] = activeGeneration === 4 ? GEN4_VERSIONS : GEN3_VERSIONS;
  const filteredEncounters = encounters.filter((e) =>
    genVersions.includes(e.version as typeof genVersions[number])
  );

  // NPC in-game trades for this Pokémon, filtered to active generation's games
  const npcTrades = allNpcTrades
    .filter((t) => t.pokemonId === id && t.games.some((g) => genVersions.includes(g as typeof genVersions[number])))
    .map((t) => ({ games: t.games, note: t.note }));

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

        {/* Sprite */}
        <div className="relative">
          <img
            src={sprite}
            alt={displayName}
            className="w-24 h-24 object-contain drop-shadow-lg"
            style={{ imageRendering: "pixelated" }}
          />
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
        {/* Evolution chain */}
        {(canEvolve || evolvesFrom !== null) && (
          <EvolutionBadge pokemon={pokemon} allPokemon={allPokemonMap} />
        )}

        {/* Location data */}
        <div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
            Where to Find
          </div>
          <LocationTable
            encounters={filteredEncounters}
            evolvesFrom={evolvesFrom}
            evolvesFromName={evolvesFrom ? (allPokemonMap.get(evolvesFrom)?.displayName ?? null) : null}
            evolvesFromDetails={
              evolvesFrom
                ? (allPokemonMap.get(evolvesFrom)?.evolvesTo.find(
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
