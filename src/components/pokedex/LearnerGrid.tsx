import type { Pokemon } from "../../types";
import type { LearnerEntry } from "../../hooks/useAttackdex";
import { getGenSprite } from "../../lib/pokemon-display";

interface Props {
  learners: LearnerEntry[];
  allPokemon: Pokemon[];
  activeGeneration: number;
  machineLabel?: string;
  learnersLoading: boolean;
  onSelectPokemon: (id: number) => void;
}

export function LearnerGrid({
  learners,
  allPokemon,
  activeGeneration,
  machineLabel,
  learnersLoading,
  onSelectPokemon,
}: Props) {
  if (learnersLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading learners…
      </div>
    );
  }

  if (learners.length === 0) {
    return <p className="text-sm text-gray-600 py-1">None in this version.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {learners.map((entry) => {
        const pokemon = allPokemon.find((p) => p.id === entry.pokemonId);
        if (!pokemon) return null;
        const sprite = getGenSprite(pokemon, activeGeneration);

        let badge: string | null = null;
        if (entry.method === "level-up") {
          badge = entry.level === 0 ? "Lv —" : `Lv ${entry.level}`;
        } else if (entry.method === "machine" && machineLabel) {
          badge = machineLabel;
        }

        return (
          <button
            key={entry.pokemonId}
            onClick={() => onSelectPokemon(entry.pokemonId)}
            title={`View ${entry.displayName}`}
            className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors w-16 text-center"
          >
            <img
              src={sprite}
              alt={entry.displayName}
              className="w-8 h-8 object-contain"
              style={{ imageRendering: "pixelated" }}
            />
            <span className="text-xs text-gray-300 leading-tight truncate w-full">{entry.displayName}</span>
            {badge && (
              <span className="text-[10px] text-gray-500 font-mono">{badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
