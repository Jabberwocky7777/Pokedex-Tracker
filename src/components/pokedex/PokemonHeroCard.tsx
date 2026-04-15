import type { Pokemon } from "../../types";
import { TYPE_COLORS } from "../../lib/type-colors";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import TypeBadge from "../shared/TypeBadge";

export function PokemonHeroCard({ pokemon, activeGeneration, compact = false }: {
  pokemon: Pokemon;
  activeGeneration: number;
  compact?: boolean;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden h-full"
      style={{ background: `linear-gradient(135deg, ${TYPE_COLORS[pokemon.types[0]] ?? "#374151"}22 0%, #111827 60%)` }}
    >
      <div className={`${compact ? "p-4" : "p-6"} flex flex-col items-center gap-3 h-full`}>
        <img
          src={getGenSprite(pokemon, activeGeneration)}
          alt={pokemon.displayName}
          className={`${compact ? "w-20 h-20" : "w-28 h-28"} object-contain drop-shadow-2xl flex-shrink-0`}
          style={{ imageRendering: "pixelated" }}
        />
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="text-xs text-gray-500 font-mono">#{formatDexNumber(pokemon.id)}</div>
          <h3 className={`${compact ? "text-xl" : "text-2xl"} font-bold text-white`}>{pokemon.displayName}</h3>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {pokemon.types.map((t) => <TypeBadge key={t} type={t} />)}
          </div>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {pokemon.isLegendary && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700/50">◆ Legendary</span>
            )}
            {pokemon.isMythical && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300 border border-purple-700/50">✦ Mythical</span>
            )}
            {pokemon.isBaby && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-900/50 text-pink-300 border border-pink-700/50">♡ Baby</span>
            )}
          </div>
          <div className="text-xs text-gray-400">
            Catch rate: <span className="text-gray-200 font-medium">{pokemon.catchRate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
