import { useState, useRef } from "react";
import { useSettingsStore } from "../../store/useSettingsStore";

interface Props {
  /** Mobile-friendly mode: shows an icon button that expands inline on click */
  compact?: boolean;
  /** Expand input to fill parent container width */
  fullWidth?: boolean;
}

export default function SearchBar({ compact = false, fullWidth = false }: Props) {
  const searchQuery = useSettingsStore((s) => s.searchQuery);
  const setSearchQuery = useSettingsStore((s) => s.setSearchQuery);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (compact && !expanded && !searchQuery) {
    return (
      <button
        onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        aria-label="Open search"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </button>
    );
  }

  return (
    <div className={`relative${fullWidth ? " w-full" : ""}`}>
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search Pokémon…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onBlur={() => { if (compact && !searchQuery) setExpanded(false); }}
        style={{ fontSize: '16px' }}
        className={`pl-8 pr-8 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors ${fullWidth ? "w-full" : "w-40"}`}
      />
      {searchQuery && (
        <button
          onClick={() => { setSearchQuery(""); if (compact) setExpanded(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
