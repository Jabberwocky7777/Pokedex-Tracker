import { useMemo, useState } from "react";
import type { GameVersion, MetaData, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { buildNextLocations } from "../../lib/what-next";
import { METHOD_ORDER, METHOD_LABELS, METHOD_ICONS } from "../../hooks/useRouteIndex";
import { getGenSprite } from "../../lib/pokemon-display";
import { useSaveStore } from "../../store/useSaveStore";
import { genConfigOf } from "../../lib/save/types";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  caughtIds: number[];
  onRouteClick: (slug: string) => void;
}

const PAGE_SIZE = 40;

function levelLabel(min: number, max: number): string {
  return min === max ? `Lv. ${min}` : `Lv. ${min}–${max}`;
}

/**
 * "What can I get next": locations in the selected games, ranked by how many
 * Pokémon you haven't caught yet can be found there.
 */
export default function WhatNextView({ allPokemon, meta, caughtIds, onRouteClick }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const includeSetup = useSettingsStore((s) => s.nextIncludeSetup);
  const setIncludeSetup = useSettingsStore((s) => s.setNextIncludeSetup);
  const [shown, setShown] = useState(PAGE_SIZE);
  // A living-dex save of this generation has its own, more specific to-do list
  const hasLivingDex = useSaveStore((s) =>
    s.profiles.some((p) => p.role === "living-dex" && genConfigOf(p.family).gen === activeGeneration));
  const openTodo = () => {
    useSaveStore.getState().setPanel("todo");
    useSettingsStore.getState().setViewMode("saves");
  };

  const genMeta = meta.generations.find((g) => g.id === activeGeneration);

  const locations = useMemo(() => {
    if (!genMeta) return [];
    const [start, end] = genMeta.pokemonRange;
    const games: string[] = activeGames.length > 0 ? activeGames : genMeta.versions;
    return buildNextLocations(
      allPokemon.filter((p) => p.id >= start && p.id <= end),
      games,
      new Set(caughtIds),
      includeSetup,
    );
  }, [allPokemon, genMeta, activeGames, caughtIds, includeSetup]);

  const gameLabel =
    activeGames.length > 0
      ? activeGames.map((g) => GAME_LABELS[g]).join(", ")
      : `all ${genMeta?.name ?? ""} games`;
  const showGames = activeGames.length !== 1;

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[14rem]">
          <h2 className="text-base font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>
            What can I get next
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Locations in {gameLabel}, ranked by how many Pokémon you haven&apos;t caught are found there.
            Tap a location to open it in Routes.
          </p>
        </div>
        {hasLivingDex && (
          <button
            onClick={openTodo}
            className="px-3 py-2 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/40 text-xs text-amber-200 font-medium transition-colors"
          >
            ★ Living-dex to-do list →
          </button>
        )}
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700">
          <input
            type="checkbox"
            checked={includeSetup}
            onChange={(e) => setIncludeSetup(e.target.checked)}
            className="accent-indigo-500 w-4 h-4"
          />
          Include outbreak, Poké Radar, Slot 2 and radio
        </label>
      </div>

      {locations.length === 0 && (
        <p className="text-sm text-gray-400 italic py-6 text-center">
          Nothing left to find in {gameLabel} with these settings.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {locations.slice(0, shown).map((loc) => {
          const methods = [...loc.byMethod].sort(
            (a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method),
          );
          return (
            <li key={loc.slug} className="rounded-xl bg-gray-900 border border-gray-800 p-3">
              <button
                onClick={() => onRouteClick(loc.slug)}
                className="flex items-center gap-2 w-full text-left group"
                title="Open in Routes"
              >
                <span className="min-w-[2rem] px-2 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-bold text-center tabular-nums">
                  {loc.count}
                </span>
                <span className="text-sm font-semibold text-gray-100 group-hover:text-indigo-300 transition-colors">
                  {loc.displayName}
                </span>
                <span className="text-xs text-gray-500 group-hover:text-indigo-400 transition-colors ml-auto flex-shrink-0">
                  Routes →
                </span>
              </button>

              <div className="mt-2 flex flex-col gap-2">
                {methods.map(({ method, targets }) => (
                  <div key={method} className="flex items-start gap-2">
                    <span className="w-28 flex-shrink-0 text-xs text-gray-400 pt-2">
                      {METHOD_ICONS[method] ? `${METHOD_ICONS[method]} ` : ""}{METHOD_LABELS[method] ?? method}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {targets.map((t) => {
                        const detail = [
                          levelLabel(t.minLevel, t.maxLevel),
                          t.times.join("/"),
                          showGames ? t.games.map((g) => GAME_LABELS[g as GameVersion] ?? g).join(", ") : "",
                        ].filter(Boolean).join(" · ");
                        return (
                          <div
                            key={t.pokemon.id}
                            title={`${t.pokemon.displayName} — ${detail}`}
                            className="flex flex-col items-center w-16 rounded-lg bg-gray-800/60 px-1 py-1"
                          >
                            <img
                              src={getGenSprite(t.pokemon, activeGeneration)}
                              alt={t.pokemon.displayName}
                              loading="lazy"
                              className="w-10 h-10 object-contain"
                              style={{ imageRendering: "pixelated" }}
                            />
                            <span className="text-[10px] text-gray-300 leading-tight tabular-nums">
                              {levelLabel(t.minLevel, t.maxLevel)}
                            </span>
                            {t.times.length > 0 && (
                              <span className="text-[10px] text-indigo-300 leading-tight">{t.times.join("/")}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {locations.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE_SIZE)}
          className="self-center px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
        >
          Show more ({locations.length - shown} more locations)
        </button>
      )}
    </div>
  );
}
