import { useState, useEffect, useRef } from "react";
import type { Pokemon } from "../../types";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";

export interface PokemonSuggestion {
  pokemon: Pokemon;
  evYield?: number;
  statLabel?: string;
  stars?: 2 | 3;
}

interface Props {
  query: string;
  setQuery: (q: string) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  suggestions: PokemonSuggestion[];
  onSelect: (p: Pokemon) => void;
  onClear: () => void;
  placeholder: string;
  activeGeneration: number;
  accentColor: "indigo" | "pink";
}

export default function PokemonSearchBar({
  query,
  setQuery,
  showDropdown,
  setShowDropdown,
  suggestions,
  onSelect,
  onClear,
  placeholder,
  activeGeneration,
  accentColor,
}: Props) {
  const focusRing = accentColor === "indigo" ? "focus:border-indigo-500" : "focus:border-pink-500";
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHighlightedIndex(-1); }, [suggestions]); // eslint-disable-line react-hooks/set-state-in-effect -- reset keyboard cursor when suggestion list changes

  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="text"
        aria-label={accentColor === "indigo" ? "Search Pokémon" : "Compare with Pokémon"}
        role="combobox"
        aria-expanded={showDropdown && suggestions.length > 0}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
          if (e.target.value === "") onClear();
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        onKeyDown={(e) => {
          if (!showDropdown || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((i) => Math.max(i - 1, -1));
          } else if (e.key === "Enter" && highlightedIndex >= 0) {
            e.preventDefault();
            onSelect(suggestions[highlightedIndex].pokemon);
            setShowDropdown(false);
            setHighlightedIndex(-1);
          } else if (e.key === "Escape") {
            setShowDropdown(false);
            setHighlightedIndex(-1);
          }
        }}
        className={`w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none ${focusRing}`}
      />
      {showDropdown && suggestions.length > 0 && (
        <div ref={dropdownRef} className="absolute z-20 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-y-auto max-h-80">
          {suggestions.map(({ pokemon: p, evYield, statLabel, stars }, index) => (
            <button
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p);
                setShowDropdown(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left border-b border-gray-700/40 last:border-0 ${highlightedIndex === index ? "bg-gray-700" : "hover:bg-gray-700"}`}
            >
              <img
                src={getGenSprite(p, activeGeneration)}
                alt={p.displayName}
                className="w-8 h-8 object-contain flex-shrink-0"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-sm text-gray-200 flex-1">{p.displayName}</span>
              {evYield != null && statLabel ? (
                <span className="text-xs text-emerald-400 font-mono flex-shrink-0">+{evYield} {statLabel}</span>
              ) : (
                <span className="text-xs text-gray-500 flex-shrink-0">#{formatDexNumber(p.id)}</span>
              )}
              {stars != null && (
                <span className="text-xs text-amber-400 flex-shrink-0 ml-1">{stars === 3 ? "★★★" : "★★"}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
