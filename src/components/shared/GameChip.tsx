import type { ReactNode } from "react";
import { GAME_COLORS, GAME_LABELS, type GameVersion } from "../../types";

const FALLBACK = "#6b7280";

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const lin = (i: number) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}

/** White or near-black, whichever reads better on the game's colour. */
function inkOn(hex: string): string {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance("#16181d") + 0.05);
  return onWhite >= onDark ? "#ffffff" : "#16181d";
}

interface ChipProps {
  game: GameVersion;
  size?: "sm" | "md";
  /** Off: the neutral look of an unselected filter */
  selected?: boolean;
  /** Makes the chip a toggle button */
  onClick?: () => void;
  children?: ReactNode;
}

/** A game's name in its colour — the one look for game filters and game labels. */
export function GameChip({ game, size = "md", selected = true, onClick, children }: ChipProps) {
  const color = GAME_COLORS[game] ?? FALLBACK;
  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm";
  const className = `inline-flex items-center rounded-md font-semibold whitespace-nowrap transition-colors ${sizeClass} ${
    selected ? "" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
  }`;
  const style = selected ? { backgroundColor: color, color: inkOn(color) } : undefined;
  const label = children ?? GAME_LABELS[game] ?? game;

  if (!onClick) return <span className={className} style={style}>{label}</span>;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={className} style={style}>
      {label}
    </button>
  );
}

/** A small dot in a game's colour, for lists; pair it with GameLegend so the colours are explained. */
export function GameDot({ game }: { game: string }) {
  return (
    <span
      className="w-2 h-2 rounded-full inline-block flex-shrink-0"
      style={{ backgroundColor: GAME_COLORS[game as GameVersion] ?? FALLBACK }}
      title={GAME_LABELS[game as GameVersion] ?? game}
    />
  );
}

/** What each dot colour means. */
export function GameLegend({ games }: { games: readonly GameVersion[] }) {
  if (games.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400" aria-label="Game colours">
      {games.map((g) => (
        <li key={g} className="flex items-center gap-1.5">
          <GameDot game={g} />
          {GAME_LABELS[g] ?? g}
        </li>
      ))}
    </ul>
  );
}
