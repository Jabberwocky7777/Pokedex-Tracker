import { useState, useEffect, useRef } from "react";
import type { MoveSummary } from "../../lib/move-list-fetch";
import TypeBadge from "../shared/TypeBadge";

interface Props {
  query: string;
  setQuery: (q: string) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  suggestions: (MoveSummary & { type?: string })[];
  onSelect: (slug: string) => void;
  onClear: () => void;
}

export default function MoveSearchBar({
  query,
  setQuery,
  showDropdown,
  setShowDropdown,
  suggestions,
  onSelect,
  onClear,
}: Props) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHighlightedIndex(-1); }, [suggestions]);

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
        placeholder="Search for a move…"
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
            onSelect(suggestions[highlightedIndex].slug);
            setShowDropdown(false);
            setHighlightedIndex(-1);
          } else if (e.key === "Escape") {
            setShowDropdown(false);
            setHighlightedIndex(-1);
          }
        }}
        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
      />
      {showDropdown && suggestions.length > 0 && (
        <div ref={dropdownRef} className="absolute z-20 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-y-auto max-h-80">
          {suggestions.map((s, index) => (
            <button
              key={s.slug}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(s.slug);
                setShowDropdown(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left border-b border-gray-700/40 last:border-0 ${highlightedIndex === index ? "bg-gray-700" : "hover:bg-gray-700"}`}
            >
              <span className="text-sm text-gray-200 flex-1">{s.displayName}</span>
              {s.type && <TypeBadge type={s.type} size="sm" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
