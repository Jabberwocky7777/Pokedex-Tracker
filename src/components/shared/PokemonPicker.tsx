import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";
import { formatDexNumber } from "../../lib/pokemon-display";
import { generationMaxId } from "../../lib/generation";

interface Props {
  allPokemon: Pokemon[];
  activeGeneration: number;
  onSelect: (pokemonId: number) => void;
  onClose: () => void;
  title?: string;
  /** Pokémon to flag in the list (e.g. already in a box), with the text to show */
  tagged?: ReadonlySet<number>;
  tagLabel?: string;
}

/** Modal list of the generation's Pokémon with a search box and keyboard navigation. */
export default function PokemonPicker({ allPokemon, activeGeneration, onSelect, onClose, title = "Choose Pokémon", tagged, tagLabel }: Props) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset highlight when query changes
  useEffect(() => {
    setHighlightedIndex(-1); // eslint-disable-line react-hooks/set-state-in-effect -- reset keyboard cursor when query changes
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const maxId = generationMaxId(activeGeneration);

  const filtered = allPokemon
    .filter((p) => p.id <= maxId)
    .filter((p) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.displayName.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        formatDexNumber(p.id).includes(q)
      );
    });

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        onSelect(filtered[highlightedIndex].id);
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-sm flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm font-semibold text-white">{title}</span>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-200">
            <X size={16} />
          </button>
        </div>
        <div className="px-3 py-2 border-b border-gray-700">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by name or number…"
            aria-label="Search Pokémon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div ref={listRef} className="overflow-y-auto flex-1">
          {filtered.map((p, index) => {
            const sprite = getGenSprite(p, activeGeneration);
            return (
              <button
                key={p.id}
                onClick={() => { onSelect(p.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left ${highlightedIndex === index ? "bg-gray-700" : "hover:bg-gray-800"}`}
              >
                {sprite && (
                  <img src={sprite} alt={p.displayName} className="w-8 h-8 object-contain pixelated flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200">{p.displayName}</div>
                  <div className="text-xs text-gray-500">#{formatDexNumber(p.id)}</div>
                </div>
                {tagLabel && tagged?.has(p.id) && (
                  <span className="text-xs text-amber-400 flex-shrink-0">{tagLabel}</span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No results</p>
          )}
        </div>
      </div>
    </div>
  );
}
