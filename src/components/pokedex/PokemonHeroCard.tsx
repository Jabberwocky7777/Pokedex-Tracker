import { useState } from "react"; // shiny toggle added
import type { Pokemon } from "../../types";
import { TYPE_COLORS } from "../../lib/type-colors";
import { getGenSprite, getGenShinySprite, formatDexNumber } from "../../lib/pokemon-display";
import TypeBadge from "../shared/TypeBadge";
import { STAT_LABELS_SHORT } from "../../lib/ev-search";
import type { StatKey } from "../../lib/iv-calc";

export function PokemonHeroCard({ pokemon, activeGeneration, compact = false }: {
  pokemon: Pokemon;
  activeGeneration: number;
  compact?: boolean;
}) {
  const [showShiny, setShowShiny] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden h-full"
      style={{ background: `linear-gradient(135deg, ${TYPE_COLORS[pokemon.types[0]] ?? "#374151"}22 0%, #111827 60%)` }}
    >
      <div className={`${compact ? "p-4" : "p-6"} flex flex-col items-center gap-3 h-full`}>
        <div className="relative flex-shrink-0">
          <img
            src={showShiny ? getGenShinySprite(pokemon, activeGeneration) : getGenSprite(pokemon, activeGeneration)}
            alt={pokemon.displayName}
            className={`${compact ? "w-20 h-20" : "w-28 h-28"} object-contain drop-shadow-2xl`}
            style={{ imageRendering: "pixelated" }}
          />
          <button
            onClick={() => setShowShiny((v) => !v)}
            title={showShiny ? "Showing shiny — click to switch back" : "Preview shiny sprite"}
            className={`absolute -top-1 -right-1 text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
              showShiny
                ? "bg-yellow-400/20 text-yellow-300 ring-1 ring-yellow-400/40"
                : "bg-gray-700/80 text-gray-500 hover:text-gray-300"
            }`}
          >
            ✦
          </button>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="text-xs text-gray-500 font-mono">#{formatDexNumber(pokemon.id)}</div>
          <h3 className={`${compact ? "text-xl" : "text-2xl"} font-bold text-white`} style={{ fontFamily: 'var(--theme-font-display)' }}>{pokemon.displayName}</h3>
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
          {pokemon.evYield && Object.entries(pokemon.evYield).some(([, v]) => (v ?? 0) > 0) && (
            <div className="text-xs text-gray-400">
              EV yield:{" "}
              <span className="text-emerald-400 font-medium">
                {Object.entries(pokemon.evYield)
                  .filter(([, v]) => (v ?? 0) > 0)
                  .map(([k, v]) => `${v} ${STAT_LABELS_SHORT[k as StatKey]}`)
                  .join(", ")}
              </span>
            </div>
          )}
          {pokemon.abilities && pokemon.abilities.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center mt-0.5">
              {pokemon.abilities.map((a) => (
                <span
                  key={a.name}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    a.isHidden
                      ? "bg-gray-800 text-gray-400 border-gray-600/50"
                      : "bg-indigo-900/50 text-indigo-300 border-indigo-700/50"
                  }`}
                >
                  {a.displayName}{a.isHidden ? " (H)" : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
