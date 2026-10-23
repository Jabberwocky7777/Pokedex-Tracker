import { useRef, useEffect } from "react";
import type { FilteredPokemon } from "../../hooks/usePokemonFilter";
import { TYPE_COLORS } from "../../lib/type-colors";
import { formatDexNumber } from "../../lib/pokemon-display";
import { useLongPress } from "../../hooks/useLongPress";

interface Props {
  pokemon: FilteredPokemon;
  isCaught: boolean;
  isPending: boolean;
  isSelected: boolean;
  isShiny: boolean;
  /** In its own slot in the living dex — shown as a gold star instead of the green check. */
  isPlaced?: boolean;
  /** Quick mark: a single tap/click toggles caught instead of opening the detail panel. */
  quickMark: boolean;
  onClick: () => void;
  onToggleCaught: () => void;
  onTogglePending: () => void;
}

export default function PokemonCell({
  pokemon,
  isCaught,
  isPending,
  isSelected,
  isShiny,
  isPlaced = false,
  quickMark,
  onClick,
  onToggleCaught,
  onTogglePending,
}: Props) {
  const { id, displayName, types, spriteUrl, genSprite, shinySprite, isHighlighted, isVersionExclusive } = pokemon;
  const sprite = isShiny ? shinySprite : (genSprite || spriteUrl);
  const typeColor = TYPE_COLORS[types[0]] ?? "#6b7280";

  // Disambiguate single-click (select) from double-click (toggle caught).
  // Without this, a double-click fires two onClick events before onDoubleClick,
  // causing the detail panel to flash open then closed.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timer if the component unmounts mid-debounce.
  useEffect(() => () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
  }, []);

  // Touch: press and hold (~500ms) toggles pending.
  const longPress = useLongPress(onTogglePending);

  function handleClick() {
    // The click that follows a long-press belongs to the long-press.
    if (longPress.consumeClick()) return;
    if (quickMark) {
      onToggleCaught();
      return;
    }
    if (clickTimer.current !== null) {
      // Second click arrived within the window — this is a double-click.
      // Cancel the pending single-click so the panel never opens.
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onClick();
    }, 220); // slightly longer than the OS double-click threshold (~200ms)
  }

  function handleDoubleClick() {
    // In quick-mark mode each click already toggled; a double-click is just two taps.
    if (quickMark) return;
    // The second handleClick call already cleared the timer, so the panel
    // won't open. Just fire the toggle action.
    onToggleCaught();
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    // Android fires contextmenu on a touch long-press — useLongPress already handled it.
    if (longPress.wasTouch()) return;
    onTogglePending();
  }

  return (
    <button
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      {...longPress.handlers}
      title={`#${formatDexNumber(id)} ${displayName}${isShiny ? " ✦ Shiny" : ""}${isPlaced ? " ★ Placed" : ""}\n${quickMark ? "Click to toggle caught" : "Double-click to toggle caught"}\nRight-click or long-press to toggle pending`}
      className={`
        relative group flex flex-col items-center justify-end
        w-full rounded-lg overflow-hidden select-none
        border-2 transition-all duration-150 cursor-pointer
        ${longPress.pressing ? "scale-95 brightness-125 ring-2 ring-yellow-400/60" : ""}
        ${isSelected
          ? "border-indigo-400 shadow-lg shadow-indigo-500/30"
          : isPlaced
            ? "border-amber-400/70 hover:border-amber-300"
            : "border-transparent hover:border-gray-600"
        }
        ${!isHighlighted ? "opacity-25" : ""}
        ${isPlaced || isCaught ? "bg-gray-800/80" : isPending ? "bg-yellow-900/20" : "bg-gray-900"}
      `}
      style={{ aspectRatio: "1", minHeight: "64px", touchAction: "manipulation", WebkitTouchCallout: "none" }}
    >
      {/* Type color background strip at bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 opacity-10"
        style={{ backgroundColor: typeColor }}
      />

      {/* Placed overlay — takes over from the caught tint */}
      {isPlaced && (
        <div className="absolute inset-0 bg-amber-400/15 pointer-events-none" />
      )}

      {/* Caught overlay */}
      {isCaught && !isPlaced && (
        <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
      )}

      {/* Pending overlay */}
      {isPending && !isCaught && !isPlaced && (
        <div className="absolute inset-0 bg-yellow-500/10 pointer-events-none" />
      )}

      {/* Sprite */}
      <img
        src={sprite}
        alt={displayName}
        loading="lazy"
        draggable={false}
        className={`w-full h-full object-contain p-1 transition-opacity pointer-events-none ${
          isCaught || isPending || isPlaced ? "opacity-100" : "opacity-60 group-hover:opacity-90"
        }`}
        style={{ imageRendering: "pixelated" }}
      />

      {/* Status dot: gold star = placed, green = caught, yellow = pending */}
      {isPlaced && (
        <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center text-[9px] leading-none text-gray-900" title="Placed in your living dex">
          ★
        </div>
      )}
      {isCaught && !isPlaced && (
        <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      {isPending && !isCaught && !isPlaced && (
        <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center" title="Pending: have the pre-evolution, need to evolve">
          <svg className="w-2 h-2 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Version exclusive icon */}
      {isVersionExclusive && (
        <div className="absolute top-0.5 left-0.5 text-yellow-400 text-xs leading-none" title="Version exclusive">
          ★
        </div>
      )}

      {/* Shiny badge */}
      {isShiny && (
        <div className="absolute bottom-0 left-0 text-[9px] leading-none text-yellow-300 drop-shadow" title="Shiny">
          ✦
        </div>
      )}

      {/* Legendary/mythical icon */}
      {(pokemon.isLegendary || pokemon.isMythical) && (
        <div className="absolute top-0.5 right-0.5 text-xs" title={pokemon.isMythical ? "Mythical" : "Legendary"}>
          {pokemon.isMythical ? "✦" : "◆"}
        </div>
      )}

      {/* Number on hover */}
      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
        <span className="text-white text-xs font-mono">
          #{formatDexNumber(pokemon.displayNumber)}
        </span>
      </div>
    </button>
  );
}
