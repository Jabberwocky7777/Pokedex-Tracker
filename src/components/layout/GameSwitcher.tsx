import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePopoverAnchor } from "../../hooks/usePopoverAnchor";
import { GAME_ABBR, GAME_COLORS, GAME_LABELS, type GameVersion, type MetaData } from "../../types";

/** "SoulSilver", "HeartGold + SoulSilver", "Diamond +2", "All Gen 4 games" */
function gamesLabel(games: readonly GameVersion[], generation: number): string {
  if (games.length === 0) return `All Gen ${generation} games`;
  if (games.length === 1) return GAME_LABELS[games[0]] ?? games[0];
  if (games.length === 2) return games.map((g) => GAME_LABELS[g] ?? g).join(" + ");
  return `${GAME_LABELS[games[0]] ?? games[0]} +${games.length - 1}`;
}

/** The same, short, for a phone's header: "SS", "HG + SS", "Gen 4" */
function shortLabel(games: readonly GameVersion[], generation: number): string {
  if (games.length === 0) return `Gen ${generation}`;
  if (games.length <= 2) return games.map((g) => GAME_ABBR[g] ?? GAME_LABELS[g] ?? g).join(" + ");
  return `${GAME_ABBR[games[0]] ?? games[0]} +${games.length - 1}`;
}

function Dot({ game }: { game: GameVersion }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/30"
      style={{ backgroundColor: GAME_COLORS[game] ?? "#6b7280" }}
      aria-hidden="true"
    />
  );
}

/**
 * The games you are playing, for the whole app: the tracker, Plan and Routes all follow it.
 * Pick one, or several to compare versions; none is every game of the generation. Choosing a
 * game of the other generation switches generation. Replaces the Gen 3 / Gen 4 toggle and the
 * game rows that used to sit in the tracker's and Routes' toolbars.
 */
export default function GameSwitcher({ meta, compact = false }: { meta: MetaData; compact?: boolean }) {
  const generation = useSettingsStore((s) => s.activeGeneration);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const setGeneration = useSettingsStore((s) => s.setActiveGeneration);
  const toggleGame = useSettingsStore((s) => s.toggleActiveGame);
  const clearGames = useSettingsStore((s) => s.clearActiveGames);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(panelRef, open, close);
  // A sheet on a phone, a menu under the button otherwise
  const asSheet = useMediaQuery("(max-width: 767.98px), (max-height: 500px)");
  const { ref: anchorRef, position: anchorPosition, measure: measureAnchor } = usePopoverAnchor();

  const generations = meta.generations.filter((g) => meta.activeGenerations.includes(g.id));
  const label = gamesLabel(activeGames, generation);

  const pickAll = (gen: number) => {
    if (gen !== generation) setGeneration(gen);
    else clearGames();
  };
  const pickGame = (gen: number, game: GameVersion) => {
    if (gen !== generation) setGeneration(gen); // clears the selection too
    toggleGame(game);
  };

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={asSheet ? true : undefined}
      aria-label="Games"
      tabIndex={-1}
      className={
        asSheet
          ? "fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
          : "fixed z-50 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-1.5 max-h-[80vh] overflow-y-auto"
      }
      style={
        asSheet
          ? {
              paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
              paddingLeft: "env(safe-area-inset-left)",
              paddingRight: "env(safe-area-inset-right)",
            }
          : anchorPosition
      }
    >
      {asSheet && (
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Games</span>
          <button
            onClick={close}
            aria-label="Close"
            className="p-2.5 -mr-2 rounded-full text-gray-400 hover:text-gray-100 hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>
      )}
      {generations.map((g) => {
        const here = g.id === generation;
        const versions = g.versions as GameVersion[];
        return (
          <div key={g.id} className={asSheet ? "px-2 pb-2" : "py-1"}>
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Generation {g.id}
            </p>
            <button
              onClick={() => pickAll(g.id)}
              aria-pressed={here && activeGames.length === 0}
              className="w-full flex items-center gap-3 px-3 min-h-10 pointer-coarse:min-h-12 rounded-lg text-sm text-left text-gray-200 hover:bg-gray-800"
            >
              <span className="flex -space-x-1 w-6 flex-shrink-0" aria-hidden="true">
                {versions.slice(0, 3).map((v) => (
                  <Dot key={v} game={v} />
                ))}
              </span>
              <span className="flex-1">All Gen {g.id} games</span>
              {here && activeGames.length === 0 && <Check size={16} className="text-indigo-300" aria-hidden="true" />}
            </button>
            {versions.map((v) => {
              const on = here && activeGames.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => pickGame(g.id, v)}
                  aria-pressed={on}
                  className={`w-full flex items-center gap-3 px-3 min-h-10 pointer-coarse:min-h-12 rounded-lg text-sm text-left hover:bg-gray-800 ${
                    on ? "text-white" : "text-gray-300"
                  }`}
                >
                  <span className="w-6 flex justify-center flex-shrink-0">
                    <Dot game={v} />
                  </span>
                  <span className="flex-1">{GAME_LABELS[v] ?? v}</span>
                  {on && <Check size={16} className="text-indigo-300" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        );
      })}
      <p className={`text-xs text-gray-500 ${asSheet ? "px-6 pb-2" : "px-3 pb-2 pt-1"}`}>
        Pick more than one to compare versions.
      </p>
    </div>
  );

  return (
    <>
      <button
        ref={anchorRef}
        onClick={() => {
          measureAnchor();
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Games: ${label}`}
        title={label}
        data-testid="game-switcher"
        className={`flex items-center gap-2 min-w-0 rounded-lg border border-gray-700 hover:border-gray-500 bg-gray-900 text-gray-100 transition-colors ${
          compact ? "h-9 px-2.5 text-sm" : "h-9 px-3 text-sm font-medium pointer-coarse:h-11"
        }`}
      >
        <span className="flex -space-x-1 flex-shrink-0" aria-hidden="true">
          {(activeGames.length > 0
            ? activeGames
            : ((generations.find((g) => g.id === generation)?.versions ?? []) as GameVersion[])
          )
            .slice(0, 3)
            .map((g) => (
              <Dot key={g} game={g} />
            ))}
        </span>
        <span className="truncate">{compact ? shortLabel(activeGames, generation) : label}</span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <>
            <div className={`fixed inset-0 z-50 ${asSheet ? "bg-black/50" : ""}`} onClick={close} aria-hidden="true" />
            {panel}
          </>,
          document.body,
        )}
    </>
  );
}
