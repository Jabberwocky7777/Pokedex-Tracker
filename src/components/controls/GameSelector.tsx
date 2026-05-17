import { useState, useRef, useEffect } from "react";
import { useSettingsStore } from "../../store/useSettingsStore";
import { GAME_LABELS, GAME_COLORS } from "../../types";
import type { GameVersion, MetaData } from "../../types";

interface Props {
  meta: MetaData;
  /** Compact mode: shows a single dropdown button instead of inline buttons */
  compact?: boolean;
}

export default function GameSelector({ meta, compact = false }: Props) {
  const activeGames = useSettingsStore((s) => s.activeGames);
  const toggleActiveGame = useSettingsStore((s) => s.toggleActiveGame);
  const clearActiveGames = useSettingsStore((s) => s.clearActiveGames);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const genMeta = meta.generations.find((g) => g.id === activeGeneration);
  if (!genMeta) return null;

  const games = genMeta.versions as GameVersion[];
  const noneSelected = activeGames.length === 0;

  if (compact) {
    const label = noneSelected
      ? "All games"
      : activeGames.map((g) => GAME_LABELS[g] ?? g).join(", ");

    return (
      <div ref={ref} className="relative flex-1 min-w-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium bg-gray-800 border border-gray-700 text-gray-200 hover:border-gray-500 transition-colors"
        >
          <span className="truncate">{label}</span>
          <svg className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-2 min-w-[160px]">
            <button
              onClick={() => { clearActiveGames(); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-all mb-1 ${
                noneSelected ? "bg-gray-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              All games
            </button>
            {games.map((game) => {
              const isActive = activeGames.includes(game);
              const color = GAME_COLORS[game] ?? "#6b7280";
              return (
                <button
                  key={game}
                  onClick={() => toggleActiveGame(game)}
                  style={isActive ? { backgroundColor: color + "22", color } : {}}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive ? "" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  }`}
                >
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  )}
                  {GAME_LABELS[game]}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={clearActiveGames}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          noneSelected
            ? "bg-gray-600 text-white"
            : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        }`}
      >
        All
      </button>
      {games.map((game) => {
        const isActive = activeGames.includes(game);
        const color = GAME_COLORS[game] ?? "#6b7280";
        return (
          <button
            key={game}
            onClick={() => toggleActiveGame(game)}
            style={isActive ? { backgroundColor: color, color: "#fff", boxShadow: `0 0 8px ${color}60` } : {}}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              isActive
                ? "ring-2 ring-white/20"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {GAME_LABELS[game]}
          </button>
        );
      })}
    </div>
  );
}
