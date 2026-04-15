import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";

export interface SearchBarProps {
  query: string;
  setQuery: (q: string) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  suggestions: Pokemon[];
  onSelect: (p: Pokemon) => void;
  placeholder?: string;
  activeGeneration: number;
  accentColor: "indigo" | "pink";
}

export function PokemonSearchBar({
  query, setQuery, showDropdown, setShowDropdown,
  suggestions, onSelect, placeholder, activeGeneration, accentColor,
}: SearchBarProps) {
  const focusClass = accentColor === "indigo" ? "focus:border-indigo-500" : "focus:border-pink-500";
  return (
    <div className="relative flex-1">
      <input
        type="text"
        placeholder={placeholder ?? "Search by name…"}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        className={`w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none ${focusClass}`}
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((p) => {
            const sprite = getGenSprite(p, activeGeneration);
            return (
              <button
                key={p.id}
                onClick={() => { onSelect(p); setShowDropdown(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 text-left"
              >
                <img src={sprite} alt={p.displayName} className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />
                <span className="text-sm text-gray-200 flex-1">{p.displayName}</span>
                <span className="text-xs text-gray-500 font-mono">
                  {p.baseStats.hp}/{p.baseStats.atk}/{p.baseStats.def}/{p.baseStats.spAtk}/{p.baseStats.spDef}/{p.baseStats.spe}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
