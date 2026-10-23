import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";

interface Props {
  pokemon: Pokemon | null;
  isCaught: boolean;
  isPending: boolean;
  isSelected: boolean;
  activeGeneration: number;
  onAssign: () => void;
  onClear: () => void;
  onSelect: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

export default function PcBoxSlot({
  pokemon,
  isCaught,
  isPending,
  isSelected,
  activeGeneration,
  onAssign,
  onClear,
  onSelect,
  onDragStart,
  onDrop,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);

  function handleContextMenu(e: React.MouseEvent) {
    if (!pokemon) return;
    e.preventDefault();
    setShowMenu(true);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setShowMenu(false);
    onClear();
  }

  const statusDot = isCaught
    ? "bg-emerald-500"
    : isPending
    ? "bg-amber-400"
    : null;

  if (!pokemon) {
    return (
      <div
        className={`relative w-full aspect-square flex items-center justify-center border-2 border-dashed rounded cursor-pointer transition-colors ${
          dragOver
            ? "border-indigo-400 bg-indigo-900/30"
            : "border-gray-700 hover:border-gray-500 hover:bg-gray-800/50"
        }`}
        onClick={onAssign}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(); }}
      >
        <Plus size={14} className="text-gray-600" />
      </div>
    );
  }

  const sprite = getGenSprite(pokemon, activeGeneration);

  return (
    <div
      className={`relative w-full aspect-square flex flex-col items-center justify-center rounded cursor-pointer transition-colors border ${
        isSelected
          ? "border-indigo-500 bg-indigo-900/30"
          : dragOver
          ? "border-indigo-400 bg-indigo-900/20"
          : "border-transparent hover:border-gray-600 hover:bg-gray-800/50"
      }`}
      draggable
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(); }}
    >
      {sprite && (
        <img
          src={sprite}
          alt={pokemon.displayName}
          className="w-8 h-8 object-contain pixelated"
          draggable={false}
        />
      )}
      <span className="text-[11px] text-gray-400 truncate w-full text-center leading-tight px-0.5">
        {pokemon.displayName}
      </span>

      {statusDot && !hovered && (
        <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${statusDot}`} />
      )}

      {/* Hover clear button — replaces the status dot on hover */}
      {hovered && (
        <button
          className="absolute top-0 right-0 flex items-center justify-center w-4 h-4 rounded-bl rounded-tr bg-red-600 text-white"
          onClick={handleClear}
          title="Remove from box"
        >
          <X size={9} />
        </button>
      )}

      {showMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
          <div className="absolute top-full left-0 z-50 mt-0.5 bg-gray-800 border border-gray-700 rounded shadow-xl text-xs min-w-[100px]">
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-gray-700 flex items-center gap-1.5 text-red-400"
              onClick={handleClear}
            >
              <X size={12} /> Clear slot
            </button>
          </div>
        </>
      )}
    </div>
  );
}
