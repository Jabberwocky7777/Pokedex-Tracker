import { useMemo, useState } from "react";
import { Check, Lock, Star } from "lucide-react";
import type { GameVersion, MetaData, Pokemon } from "../../types";
import { GAME_ABBR, GAME_LABELS } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { buildNextLocations, byReach, onlyInGame, whenText } from "../../lib/what-next";
import { useGameProgressStore } from "../../store/useGameProgressStore";
import { useSoleSourceStore } from "../../store/useSoleSourceStore";
import { requirementText } from "../../lib/unlocks";
import { byEffort, effortText, routeEffort } from "../../lib/trip";
import { METHOD_ORDER, METHOD_LABELS, METHOD_ICONS } from "../../hooks/useRouteIndex";
import { getGenSprite } from "../../lib/pokemon-display";
import { openRoute } from "../../lib/navigate";
import { describeClock } from "../../lib/available-now";
import { useClock } from "../../hooks/useClock";
import { PokemonLink } from "../shared/links";
import { useSaveStore } from "../../store/useSaveStore";
import { genConfigOf } from "../../lib/save/types";
import { areaDisplayName } from "../../lib/area-names";
import { GameChip } from "../shared/GameChip";
import WhatNextPrint from "./WhatNextPrint";
import TripCheckOff from "./TripCheckOff";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  caughtIds: number[];
}

const PAGE_SIZE = 40;

function levelLabel(min: number, max: number): string {
  return min === max ? `Lv. ${min}` : `Lv. ${min}–${max}`;
}

/**
 * "What can I get next": locations in the selected games, ranked by how many
 * Pokémon you haven't caught yet can be found there.
 */
export default function WhatNextView({ allPokemon, meta, caughtIds }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const includeSetup = useSettingsStore((s) => s.nextIncludeSetup);
  const setIncludeSetup = useSettingsStore((s) => s.setNextIncludeSetup);
  const showCaught = useSettingsStore((s) => s.nextShowCaught);
  const setShowCaught = useSettingsStore((s) => s.setNextShowCaught);
  const reachOnly = useSettingsStore((s) => s.nextReachOnly);
  const setReachOnly = useSettingsStore((s) => s.setNextReachOnly);
  const lockedMode = useSettingsStore((s) => s.nextLockedMode);
  const setLockedMode = useSettingsStore((s) => s.setNextLockedMode);
  const progressEntries = useGameProgressStore((s) => s.entries);
  const soleSources = useSoleSourceStore((s) => s.byId);
  const sort = useSettingsStore((s) => s.nextSort);
  const setSort = useSettingsStore((s) => s.setNextSort);
  const nowOnly = useSettingsStore((s) => s.nextNowOnly);
  const setNowOnly = useSettingsStore((s) => s.setNextNowOnly);
  const clock = useClock();
  const [shown, setShown] = useState(PAGE_SIZE);
  // Routes ticked for printing — this device only, gone on reload
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const toggle = (slug: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    return next;
  });
  // A living-dex save of this generation has its own, more specific to-do list
  const hasLivingDex = useSaveStore((s) =>
    s.profiles.some((p) => p.role === "living-dex" && genConfigOf(p.family).gen === activeGeneration));
  const openTodo = () => {
    useSaveStore.getState().setPanel("todo");
    useSettingsStore.getState().setViewMode("saves");
  };

  const genMeta = meta.generations.find((g) => g.id === activeGeneration);

  const games: string[] = useMemo(
    () => (activeGames.length > 0 ? activeGames : genMeta?.versions ?? []),
    [activeGames, genMeta],
  );
  // "Only show what I can get in …" — this device only; ignored once that game isn't selected
  const [onlyGameChoice, setOnlyGame] = useState<string | null>(null);
  const onlyGame = onlyGameChoice && games.includes(onlyGameChoice) ? onlyGameChoice : null;

  const genPokemon = useMemo(() => {
    if (!genMeta) return [];
    const [start, end] = genMeta.pokemonRange;
    return allPokemon.filter((p) => p.id >= start && p.id <= end);
  }, [allPokemon, genMeta]);

  // Every location, fully caught ones too (the print can include them)
  const allLocations = useMemo(() => {
    if (!genMeta) return [];
    const built = buildNextLocations(
      genPokemon,
      games,
      new Set(caughtIds),
      includeSetup,
      nowOnly ? clock : undefined,
      { keepComplete: true },
    );
    const narrowed = onlyGame ? onlyInGame(built, onlyGame, true) : built;
    const progressOf = (g: string) => {
      const e = progressEntries[g];
      return e && !e.removed ? e : undefined;
    };
    const reached = reachOnly ? byReach(narrowed, progressOf, onlyGame ? [onlyGame] : games, lockedMode === "grey", true) : narrowed;
    return sort === "effort" ? byEffort(reached) : reached;
  }, [genPokemon, genMeta, games, caughtIds, includeSetup, nowOnly, clock, onlyGame, reachOnly, lockedMode, progressEntries, sort]);
  // On screen: places with something left to catch (or, greyed out, still to unlock)
  const locations = useMemo(
    () => allLocations.filter((l) => l.count > 0 || l.byMethod.some((m) => m.targets.some((t) => t.locked && !t.caught))),
    [allLocations],
  );

  // The routes ticked here, as a trip to check off
  const tickedTrip = useMemo(
    () => (selected.size > 0 ? { slugs: locations.filter((l) => selected.has(l.slug)).map((l) => l.slug), games: onlyGame ? [onlyGame] : games, setup: includeSetup } : null),
    [selected, locations, onlyGame, games, includeSetup],
  );

  const gameLabel =
    activeGames.length > 0
      ? activeGames.map((g) => GAME_LABELS[g]).join(", ")
      : `all ${genMeta?.name ?? ""} games`;
  const showGames = games.length > 1 && !onlyGame;

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[14rem]">
          <h2 className="text-base font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>
            What can I get next
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Locations in {gameLabel}, ranked by how many Pokémon you haven&apos;t caught are found there.
            Tap a location to open it in Routes, or a Pokémon for its details.
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
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700">
          <input
            type="checkbox"
            checked={showCaught}
            onChange={(e) => setShowCaught(e.target.checked)}
            className="accent-indigo-500 w-4 h-4"
          />
          Show caught
        </label>
        {games.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-gray-300 px-3 py-1 rounded-lg bg-gray-800/60 border border-gray-700">
            <span>Only show what I can get in</span>
            <select
              value={onlyGame ?? ""}
              onChange={(e) => setOnlyGame(e.target.value || null)}
              aria-label="Only show what I can get in this game"
              className="min-h-[32px] rounded-md bg-gray-800 border border-gray-700 text-gray-100 px-1.5"
            >
              <option value="">any selected game</option>
              {games.map((g) => <option key={g} value={g}>{GAME_LABELS[g as GameVersion] ?? g}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700">
          <input
            type="checkbox"
            checked={nowOnly}
            onChange={(e) => setNowOnly(e.target.checked)}
            className="accent-indigo-500 w-4 h-4"
          />
          <span>
            Only what&apos;s on right now
            {nowOnly && <span className="block text-[11px] text-gray-500" data-testid="next-clock">{describeClock(clock)}</span>}
          </span>
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-300 px-3 py-1 rounded-lg bg-gray-800/60 border border-gray-700">
          <span>Rank by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "count" | "effort")}
            aria-label="Rank locations by"
            className="min-h-[32px] rounded-md bg-gray-800 border border-gray-700 text-gray-100 px-1.5"
          >
            <option value="count">most to catch</option>
            <option value="effort">easiest first</option>
          </select>
        </label>
        <div className="flex items-center gap-2 text-xs text-gray-300 px-3 py-1 rounded-lg bg-gray-800/60 border border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer select-none min-h-[32px]" title="Uses your badges and milestones in Game progress">
            <input
              type="checkbox"
              checked={reachOnly}
              onChange={(e) => setReachOnly(e.target.checked)}
              className="accent-indigo-500 w-4 h-4"
            />
            Only what I can reach now
          </label>
          {reachOnly && (
            <select
              value={lockedMode}
              onChange={(e) => setLockedMode(e.target.value as "hide" | "grey")}
              aria-label="Locked entries"
              className="min-h-[32px] rounded-md bg-gray-800 border border-gray-700 text-gray-100 px-1.5"
            >
              <option value="grey">grey out the rest</option>
              <option value="hide">hide the rest</option>
            </select>
          )}
        </div>
      </div>

      {locations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="print-bar">
          <WhatNextPrint
            locations={allLocations}
            games={onlyGame ? [onlyGame] : games}
            selected={selected}
            generation={activeGeneration}
            pokemon={genPokemon}
            caughtIds={caughtIds}
            showEffort={sort === "effort"}
            includeSetup={includeSetup}
            gameLabel={onlyGame ? GAME_LABELS[onlyGame as GameVersion] ?? onlyGame : activeGames.length > 0 ? gameLabel : `All ${genMeta?.name ?? ""} games`}
            clockLabel={nowOnly ? describeClock(clock) : null}
          />
          <TripCheckOff
            pokemon={genPokemon}
            generation={activeGeneration}
            ticked={tickedTrip}
          />
          <button onClick={() => setSelected(new Set(locations.map((l) => l.slug)))} className="px-3 py-2 rounded-lg text-xs text-gray-300 hover:text-gray-100 hover:bg-gray-800">
            Select all
          </button>
          <button onClick={() => setSelected(new Set())} disabled={selected.size === 0} className="px-3 py-2 rounded-lg text-xs text-gray-300 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-40">
            Clear
          </button>
          <span className="text-xs text-gray-500">{selected.size === 0 ? "Tick routes to print only those." : `${selected.size} ticked`}</span>
        </div>
      )}

      {locations.length === 0 && (
        <p className="text-sm text-gray-400 italic py-6 text-center">
          Nothing left to find in {onlyGame ? GAME_LABELS[onlyGame as GameVersion] ?? onlyGame : gameLabel} with these settings.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {locations.slice(0, shown).map((loc) => {
          const methods = [...loc.byMethod]
            .map((m) => (showCaught ? m : { ...m, targets: m.targets.filter((t) => !t.caught) }))
            .filter((m) => m.targets.length > 0)
            .sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
          const best = showGames && loc.bestGame && Object.keys(loc.perGame).length > 1 ? loc.bestGame : null;
          return (
            <li key={loc.slug} className="rounded-xl bg-gray-900 border border-gray-800 p-3">
              <div className="flex items-center gap-2">
              <label className="flex items-center justify-center w-8 h-8 -m-1.5 flex-shrink-0 cursor-pointer" title="Tick to print this route">
                <input
                  type="checkbox"
                  checked={selected.has(loc.slug)}
                  onChange={() => toggle(loc.slug)}
                  aria-label={`Print ${areaDisplayName(loc.displayName)}`}
                  className="w-4 h-4 accent-indigo-500"
                />
              </label>
              <button
                onClick={() => openRoute(loc.slug)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left group"
                title="Open in Routes"
              >
                <span
                  className="min-w-[2rem] px-2 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-bold text-center tabular-nums"
                  title={`${loc.count} of ${loc.total} still to catch`}
                >
                  {loc.count}
                </span>
                <span className="text-sm font-semibold text-gray-100 group-hover:text-indigo-300 transition-colors">
                  {areaDisplayName(loc.displayName)}
                </span>
                <span className="text-xs text-gray-500 group-hover:text-indigo-400 transition-colors ml-auto flex-shrink-0">
                  Routes →
                </span>
              </button>
              </div>

              <p className="mt-1 text-xs text-gray-400 tabular-nums">
                {loc.uniques > 0 && (
                  <span className="text-amber-300 font-medium mr-1.5" title="Pokémon you can get nowhere else in your games — counted double in the ranking">
                    <Star size={11} className="inline -mt-0.5 fill-current" aria-hidden="true" /> {loc.uniques} only here ·
                  </span>
                )}
                {loc.total - loc.count} of {loc.total} caught
                {sort === "effort" && loc.count > 0 && <> · ~{routeEffort(loc)} encounters for the rest</>}
                {best && (
                  <>
                    {" · "}Best game: <span className="text-gray-200 font-medium">{GAME_ABBR[best as GameVersion] ?? best}</span> ({loc.perGame[best]} left)
                  </>
                )}
              </p>
              {loc.note && <p className="mt-1.5 text-xs text-gray-400">{loc.note}</p>}
              <div className="mt-2 flex flex-col gap-2">
                {methods.map(({ method, targets }) => (
                  <div key={method} className="flex flex-col sm:flex-row items-start gap-1 sm:gap-2">
                    <span className="sm:w-28 flex-shrink-0 text-xs text-gray-400 sm:pt-2">
                      {METHOD_ICONS[method] ? `${METHOD_ICONS[method]} ` : ""}{METHOD_LABELS[method] ?? method}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {targets.map((t) => {
                        const detail = [
                          levelLabel(t.minLevel, t.maxLevel),
                          whenText(t),
                          t.caught ? "" : effortText(t),
                          showGames ? t.games.map((g) => GAME_LABELS[g as GameVersion] ?? g).join(", ") : "",
                        ].filter(Boolean).join(" · ");
                        const lockText = t.locked
                          ? `${t.locked.missing.map((r) => requirementText(r, t.locked!.game)).join(", ")} (${GAME_ABBR[t.locked.game as GameVersion] ?? t.locked.game})`
                          : "";
                        return (
                          <div
                            key={t.pokemon.id}
                            title={`${t.pokemon.displayName}${t.caught ? " (caught)" : ""} — ${detail}${lockText ? ` — unlocks at: ${lockText}` : ""}${t.unique ? " — nowhere else in your games" : ""}`}
                            data-caught={t.caught || undefined}
                            data-locked={t.locked ? true : undefined}
                            className={`relative flex flex-col items-center w-[4.5rem] rounded-lg px-1 py-1 ${
                              t.caught || t.locked ? "bg-gray-800/30 opacity-50" : "bg-gray-800/60"
                            }`}
                          >
                            {t.unique && !t.caught && (
                              <span className="absolute top-0.5 left-0.5 text-amber-300" aria-label="Only here">
                                <Star size={11} className="fill-current" aria-hidden="true" />
                              </span>
                            )}
                            {t.caught && (
                              <span className="absolute top-0.5 right-0.5 rounded-full bg-emerald-600 text-white p-0.5" aria-label="Caught">
                                <Check size={10} strokeWidth={3} aria-hidden="true" />
                              </span>
                            )}
                            <PokemonLink id={t.pokemon.id} to="tracker">
                              <img
                                src={getGenSprite(t.pokemon, activeGeneration)}
                                alt={t.pokemon.displayName}
                                loading="lazy"
                                className="w-10 h-10 object-contain"
                                style={{ imageRendering: "pixelated" }}
                              />
                            </PokemonLink>
                            <span className="text-[11px] text-gray-300 leading-tight tabular-nums">
                              {levelLabel(t.minLevel, t.maxLevel)}
                            </span>
                            {t.times.length > 0 && (
                              <span className="text-[11px] text-indigo-300 leading-tight">{t.times.join("/")}</span>
                            )}
                            {t.daily && (
                              <span className="text-[11px] text-amber-300 leading-tight" title={t.daily === "trophy-garden" ? "Only on the days Mr. Backlot mentions it" : "Only on the days it shows in the binoculars"}>daily</span>
                            )}
                            {showGames && (
                              <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                                {t.games.map((g) => (
                                  <GameChip key={g} game={g as GameVersion} size="xs">{GAME_ABBR[g as GameVersion] ?? g}</GameChip>
                                ))}
                              </span>
                            )}
                            {lockText && (
                              <span className="mt-0.5 text-[10px] text-gray-400 leading-tight text-center">
                                <Lock size={9} className="inline -mt-0.5" aria-hidden="true" /> {lockText}
                              </span>
                            )}
                            {(t.onlyIn ?? soleSources.get(t.pokemon.id)) && !t.caught && (
                              <span className="mt-0.5 text-[10px] font-semibold text-amber-300 leading-tight">
                                Only in {GAME_ABBR[(t.onlyIn ?? soleSources.get(t.pokemon.id)) as GameVersion]}
                              </span>
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
