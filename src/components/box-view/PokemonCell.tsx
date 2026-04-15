import { useRef, useEffect } from "react";
import type { FilteredPokemon } from "../../hooks/usePokemonFilter";
import { TYPE_COLORS } from "../../lib/type-colors";
import { formatDexNumber } from "../../lib/pokemon-display";

interface Props {
  pokemon: FilteredPokemon;
  isCaught: boolean;
  isPending: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onRightClick: (e: React.MouseEvent) => void;
}

export default function PokemonCell({
  pokemon,
  isCaught,
  isPending,
  isSelected,
  onClick,
  onDoubleClick,
  onRightClick,
}: Props) {
  const { id, displayName, types, spriteUrl, genSprite, isHighlighted, isVersionExclusive } = pokemon;
  const sprite = genSprite || spriteUrl;
  const typeColor = TYPE_COLORS[types[0]] ?? "#6b7280";

  // Disambiguate single-click (select) from double-click (toggle caught).
  // Without this, a double-click fires two onClick events before onDoubleClick,
  // causing the detail panel to flash open then closed.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timer if the component unmounts mid-debounce.
  useEffect(() => () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
  }, []);

  function handleClick() {
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
    // The second handleClick call already cleared the timer, so the panel
    // won't open. Just fire the toggle action.
    onDoubleClick();
  }

  return (
    <button
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={onRightClick}
      title={`#${formatDexNumber(id)} ${displayName}${isPending && !isCaught ? "\n(Pending evolution — right-click to toggle)" : "\nDouble-click to toggle caught\nRight-click to toggle pending"}`}
      className={`
        relative group flex flex-col items-center justify-end
        w-full rounded-lg overflow-hidden
        border-2 transition-all duration-150 cursor-pointer
        ${isSelected
          ? "border-indigo-400 shadow-lg shadow-indigo-500/30"
          : "border-transparent hover:border-gray-600"
        }
        ${!isHighlighted ? "opacity-25" : ""}
        ${isCaught ? "bg-gray-800/80" : isPending ? "bg-yellow-900/20" : "bg-gray-900"}
      `}
      style={{ aspectRatio: "1", minHeight: "64px" }}
    >
      {/* Type color background strip at bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 opacity-10"
        style={{ backgroundColor: typeColor }}
      />

      {/* Caught overlay */}
      {isCaught && (
        <div className="absolute inset-0 bg-green-500/10 pointer-events-none" />
      )}

      {/* Pending overlay */}
      {isPending && !isCaught && (
        <div className="absolute inset-0 bg-yellow-500/10 pointer-events-none" />
      )}

      {/* Sprite */}
      <img
        src={sprite}
        alt={displayName}
        loading="lazy"
        className={`w-full h-full object-contain p-1 transition-opacity ${
          isCaught || isPending ? "opacity-100" : "opacity-60 group-hover:opacity-90"
        }`}
        style={{ imageRendering: "pixelated" }}
      />

      {/* Status dot: green = caught, yellow = pending */}
      {isCaught && (
        <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      {isPending && !isCaught && (
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
