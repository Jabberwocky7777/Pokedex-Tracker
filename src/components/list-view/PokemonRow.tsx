import type { FilteredPokemon } from "../../hooks/usePokemonFilter";
import { GAME_LABELS, GAME_COLORS, GEN3_VERSIONS, GEN4_VERSIONS } from "../../types";
import type { GameVersion } from "../../types";
import { TYPE_BG_COLORS } from "../../lib/type-colors";
import { useSettingsStore } from "../../store/useSettingsStore";

interface Props {
  pokemon: FilteredPokemon;
  isCaught: boolean;
  isPending: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleCaught: (e: React.MouseEvent) => void;
  onTogglePending: (e: React.MouseEvent) => void;
}

export default function PokemonRow({
  pokemon,
  isCaught,
  isPending,
  isSelected,
  onSelect,
  onToggleCaught,
  onTogglePending,
}: Props) {
  const { displayNumber, displayName, types, spriteUrl, genSprite, isHighlighted, isVersionExclusive } = pokemon;
  const sprite = genSprite || spriteUrl;
  const { activeGeneration } = useSettingsStore();
  const genVersions: GameVersion[] = activeGeneration === 4 ? GEN4_VERSIONS : GEN3_VERSIONS;

  return (
    <tr
      onClick={onSelect}
      className={`
        border-b border-gray-800 cursor-pointer transition-colors
        ${isSelected ? "bg-indigo-900/30 hover:bg-indigo-900/40" : "hover:bg-gray-800/50"}
        ${!isHighlighted ? "opacity-40" : ""}
        ${isCaught ? "bg-green-900/10" : isPending ? "bg-yellow-900/10" : ""}
      `}
    >
      {/* Number */}
      <td className="py-2 pl-4 pr-2 text-right">
        <span className="text-xs font-mono text-gray-500">
          #{String(displayNumber).padStart(3, "0")}
        </span>
      </td>

      {/* Sprite */}
      <td className="py-1 px-2">
        <img
          src={sprite}
          alt={displayName}
          loading="lazy"
          className="w-10 h-10 object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </td>

      {/* Name + icons */}
      <td className="py-2 px-2">
        <div className="flex items-center gap-1.5">
          <span className={`font-medium text-sm ${isCaught ? "text-green-400" : isPending ? "text-yellow-400" : "text-gray-200"}`}>
            {displayName}
          </span>
          {isVersionExclusive && (
            <span className="text-yellow-400 text-xs" title="Version exclusive">★</span>
          )}
          {(pokemon.isLegendary || pokemon.isMythical) && (
            <span className="text-xs" title={pokemon.isMythical ? "Mythical" : "Legendary"}>
              {pokemon.isMythical ? "✦" : "◆"}
            </span>
          )}
          {pokemon.hasStaticEncounter && !pokemon.isLegendary && !pokemon.isMythical && (
            <span className="text-orange-400 text-xs" title="One-time encounter">!</span>
          )}
        </div>
      </td>

      {/* Types */}
      <td className="py-2 px-2 hidden sm:table-cell">
        <div className="flex gap-1">
          {types.map((t) => (
            <span
              key={t}
              className={`px-1.5 py-0.5 rounded text-xs font-medium text-white ${TYPE_BG_COLORS[t] ?? "bg-gray-500"}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
          ))}
        </div>
      </td>

      {/* Game availability dots */}
      <td className="py-2 px-2 hidden md:table-cell">
        <div className="flex gap-1">
          {genVersions.map((game) => {
            const available = (pokemon.availableInGames as string[]).includes(game);
            const color = GAME_COLORS[game] ?? "#6b7280";
            return (
              <span
                key={game}
                title={`${GAME_LABELS[game]}: ${available ? "Available" : "Not available"}`}
                className="w-3 h-3 rounded-full border"
                style={{
                  backgroundColor: available ? color : "transparent",
                  borderColor: available ? color : "#374151",
                  opacity: available ? 1 : 0.3,
                }}
              />
            );
          })}
        </div>
      </td>

      {/* Pending checkbox — full cell is the hit target */}
      <td
        onClick={onTogglePending}
        role="checkbox"
        aria-checked={isPending}
        title="Mark as pending (have pre-evolution, need to evolve)"
        className="py-2 px-2 cursor-pointer"
      >
        <div
          className={`
            w-5 h-5 rounded border-2 flex items-center justify-center transition-all pointer-events-none
            ${isPending
              ? "bg-yellow-400 border-yellow-400"
              : "border-gray-600 group-hover:border-yellow-500"
            }
          `}
        >
          {isPending && (
            <svg className="w-3 h-3 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </td>

      {/* Caught checkbox — full cell is the hit target */}
      <td
        onClick={onToggleCaught}
        role="checkbox"
        aria-checked={isCaught}
        className="py-2 pr-4 pl-2 cursor-pointer"
      >
        <div
          className={`
            w-5 h-5 rounded border-2 flex items-center justify-center transition-all pointer-events-none
            ${isCaught
              ? "bg-green-500 border-green-500"
              : "border-gray-600 group-hover:border-green-500"
            }
          `}
        >
          {isCaught && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </td>
    </tr>
  );
}
