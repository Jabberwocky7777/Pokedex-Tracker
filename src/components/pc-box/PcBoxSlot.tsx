import { useRef, useState } from "react";
import { ArrowRightLeft, MoreHorizontal, Plus, X } from "lucide-react";
import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";
import { COARSE_POINTER } from "../../lib/pointer";
import { useLayer } from "../../hooks/useLayer";
import { useLongPress } from "../../hooks/useLongPress";

interface Props {
  pokemon: Pokemon | null;
  isCaught: boolean;
  isPending: boolean;
  isSelected: boolean;
  activeGeneration: number;
  /** Another slot is being moved: a tap here puts it here (onDrop) */
  isMoveTarget: boolean;
  /** This slot is the one being moved */
  isMoving: boolean;
  onAssign: () => void;
  onClear: () => void;
  onSelect: () => void;
  /** Start moving this slot without dragging: the next slot tapped is where it goes */
  onStartMove: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

/**
 * One slot of the tracker's PC box. With a mouse: drag to rearrange, right-click
 * (or hover ×) to clear. By touch, keyboard or D-pad: the ⋯ button, a long-press
 * or the context-menu key opens the same menu, whose Move puts the slot in the
 * hand until another slot is tapped.
 */
export default function PcBoxSlot({
  pokemon,
  isCaught,
  isPending,
  isSelected,
  activeGeneration,
  isMoveTarget,
  isMoving,
  onAssign,
  onClear,
  onSelect,
  onStartMove,
  onDragStart,
  onDrop,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useLayer(showMenu, () => setShowMenu(false), menuRef);
  const longPress = useLongPress(() => {
    if (pokemon) setShowMenu(true);
  });

  function handleContextMenu(e: React.MouseEvent) {
    if (!pokemon) return;
    e.preventDefault();
    // A touch long-press already opened it
    if (!longPress.wasTouch()) setShowMenu(true);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setShowMenu(false);
    onClear();
  }

  const statusDot = isCaught ? "bg-emerald-500" : isPending ? "bg-amber-400" : null;

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      onDrop();
    },
  };

  if (!pokemon) {
    return (
      <button
        type="button"
        data-nav="slot"
        aria-label={isMoveTarget ? "Move here" : "Empty slot. Assign a Pokémon"}
        className={`relative w-full aspect-square flex items-center justify-center border-2 border-dashed rounded cursor-pointer transition-colors ${
          dragOver || isMoveTarget
            ? "border-indigo-400 bg-indigo-900/30"
            : "border-gray-700 hover:border-gray-500 hover:bg-gray-800/50"
        }`}
        onClick={isMoveTarget ? onDrop : onAssign}
        {...dropHandlers}
      >
        {isMoveTarget ? (
          <ArrowRightLeft size={14} className="text-indigo-300" />
        ) : (
          <Plus size={14} className="text-gray-600" />
        )}
      </button>
    );
  }

  const sprite = getGenSprite(pokemon, activeGeneration);

  return (
    <div
      className="relative w-full aspect-square group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        data-nav="slot"
        aria-label={isMoveTarget ? `Swap with ${pokemon.displayName}` : pokemon.displayName}
        aria-pressed={isSelected}
        className={`w-full h-full flex flex-col items-center justify-center rounded cursor-pointer transition-colors border select-none ${
          isMoving
            ? "border-indigo-400 bg-indigo-900/40 ring-2 ring-indigo-400"
            : isSelected
              ? "border-indigo-500 bg-indigo-900/30"
              : dragOver || isMoveTarget
                ? "border-indigo-400/60 bg-indigo-900/20"
                : "border-transparent hover:border-gray-600 hover:bg-gray-800/50"
        } ${longPress.pressing ? "scale-95" : ""}`}
        draggable={!COARSE_POINTER}
        onClick={() => {
          if (longPress.consumeClick()) return;
          if (isMoveTarget) onDrop();
          else onSelect();
        }}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => {
          if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
            e.preventDefault();
            setShowMenu(true);
          }
        }}
        {...longPress.handlers}
        onDragStart={onDragStart}
        {...dropHandlers}
        style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}
      >
        {sprite && (
          <img src={sprite} alt="" className="w-8 h-8 object-contain pixelated pointer-events-none" draggable={false} />
        )}
        <span className="text-[11px] text-gray-400 truncate w-full text-center leading-tight px-0.5">
          {pokemon.displayName}
        </span>
      </button>

      {statusDot && !hovered && !COARSE_POINTER && (
        <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full pointer-events-none ${statusDot}`} />
      )}

      {/* Hover clear button — replaces the status dot on hover */}
      {hovered && !COARSE_POINTER && !isMoveTarget && (
        <button
          className="absolute top-0 right-0 flex items-center justify-center w-4 h-4 rounded-bl rounded-tr bg-red-600 text-white"
          onClick={handleClear}
          title="Remove from box"
          aria-label={`Remove ${pokemon.displayName} from box`}
        >
          <X size={9} />
        </button>
      )}

      {/* Touch and keyboard: the menu behind a visible button (shown on focus with a keyboard) */}
      {!isMoveTarget && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(true);
          }}
          aria-label={`${pokemon.displayName}: slot actions`}
          aria-haspopup="menu"
          className={`absolute -top-1 -right-1 items-center justify-center rounded-full bg-gray-700/90 text-gray-200 border border-gray-600 ${
            COARSE_POINTER ? "flex w-6 h-6" : "hidden group-focus-within:flex w-5 h-5 focus-visible:flex"
          } ${statusDot && COARSE_POINTER ? (isCaught ? "ring-1 ring-emerald-500" : "ring-1 ring-amber-400") : ""}`}
        >
          <MoreHorizontal size={12} />
        </button>
      )}

      {showMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
          <div
            ref={menuRef}
            role="menu"
            aria-label="Slot actions"
            className="absolute top-full left-0 z-50 mt-0.5 bg-gray-800 border border-gray-700 rounded shadow-xl text-xs min-w-[120px]"
          >
            <button
              role="menuitem"
              autoFocus
              className="w-full text-left px-3 py-2.5 hover:bg-gray-700 focus:bg-gray-700 flex items-center gap-1.5 text-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onStartMove();
              }}
            >
              <ArrowRightLeft size={12} /> Move
            </button>
            <button
              role="menuitem"
              className="w-full text-left px-3 py-2.5 hover:bg-gray-700 focus:bg-gray-700 flex items-center gap-1.5 text-red-400"
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
