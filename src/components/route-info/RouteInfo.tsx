import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import { useRouteIndex, METHOD_ORDER, METHOD_LABELS, METHOD_ICONS } from "../../hooks/useRouteIndex";
import type { RouteData, RouteEntry } from "../../hooks/useRouteIndex";
import { GAME_LABELS, GAME_COLORS, GEN3_GAME_ORDER, GEN4_GAME_ORDER } from "../../types";
import type { Pokemon, MetaData, GameVersion, EncounterMethod } from "../../types";
import { formatDexNumber } from "../../lib/pokemon-display";
import TypeBadge from "../shared/TypeBadge";
import Header from "../layout/Header";
import FilterSubbar from "../layout/FilterSubbar";
import GreatMarshBanner from "./GreatMarshBanner";
import { isGreatMarshSlug } from "../../data/great-marsh";
import SinnohMap from "./SinnohMap";
import HGSSMap from "./HGSSMap";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

// Game ordering for column display — imported from types so all components stay in sync.
// Widened to GameVersion[] so .includes() accepts any GameVersion at callsites.
const ALL_GAME_ORDER: GameVersion[] = [...GEN3_GAME_ORDER, ...GEN4_GAME_ORDER];

export default function RouteInfo({ allPokemon, meta }: Props) {
  const activeGames = useSettingsStore((s) => s.activeGames);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const activeRoute = useSettingsStore((s) => s.activeRoute);
  const setActiveRoute = useSettingsStore((s) => s.setActiveRoute);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const routeDetailRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  // Clear selected route when activeGeneration actually changes (not on initial mount).
  // Tracks the previous generation so we only clear when it genuinely flips,
  // which also survives React Strict Mode's double-invoke of effects.
  const prevGenRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevGenRef.current !== null && prevGenRef.current !== activeGeneration) {
      setActiveRoute(null);
    }
    prevGenRef.current = activeGeneration;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGeneration]);

  const handleMapRouteClick = (slug: string) => {
    setActiveRoute(slug);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (routeDetailRef.current && mainScrollRef.current) {
        const mainEl = mainScrollRef.current;
        const mainRect = mainEl.getBoundingClientRect();
        const detailRect = routeDetailRef.current.getBoundingClientRect();
        const targetScrollTop = mainEl.scrollTop + (detailRect.top - mainRect.top) - 12;
        mainEl.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      }
    }));
  };

  const routeIndex = useRouteIndex(allPokemon, activeGames);

  const routeList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Array.from(routeIndex.values())
      .filter((r) => !q || r.displayName.toLowerCase().includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [routeIndex, search]);

  const selectedRoute = activeRoute ? routeIndex.get(activeRoute) ?? null : null;

  const genMeta = meta.generations.find((g) => g.id === activeGeneration);
  const allGenGames = (genMeta?.versions ?? []) as GameVersion[];
  const gamesToShow = activeGames.length > 0 ? activeGames : allGenGames;
  const orderedGames = ALL_GAME_ORDER.filter((g) => gamesToShow.includes(g));

  // Show HGSS map only when active games are exclusively HG/SS (no D/P/Pt mixed in).
  // Empty activeGames (no filter) defaults to Sinnoh.
  const HGSS_GAME_SET = new Set<GameVersion>(["heartgold", "soulsilver"]);
  const showHGSSMap =
    activeGames.length > 0 && activeGames.every((g) => HGSS_GAME_SET.has(g));

  return (
    <div className="flex flex-col h-full">
      <Header meta={meta} />
      <FilterSubbar meta={meta} caught={0} total={0} tab="routes" />

      <main className="flex-1 overflow-y-auto" ref={(el) => { mainScrollRef.current = el; }}>
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">

          {/* ── Search bar + view toggle ── */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (activeRoute && viewMode === "list") setActiveRoute(null);
                  }}
                  placeholder="Search routes and areas…"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                {(search || (activeRoute && viewMode === "list")) && (
                  <button
                    onClick={() => { setSearch(""); setActiveRoute(null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    aria-label="Clear"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {activeGeneration === 4 && (
                <div className="flex rounded-lg border border-gray-700 overflow-hidden flex-shrink-0">
                  <button
                    onClick={() => setViewMode("map")}
                    className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === "map" ? "bg-indigo-600 text-white" : "bg-gray-900 text-gray-400 hover:text-gray-200"}`}
                  >
                    Map
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-2 text-xs font-medium transition-colors border-l border-gray-700 ${viewMode === "list" ? "bg-indigo-600 text-white" : "bg-gray-900 text-gray-400 hover:text-gray-200"}`}
                  >
                    List
                  </button>
                </div>
              )}
            </div>
            {viewMode === "list" && (
              <div className="text-xs text-gray-600 px-1">
                {routeList.length} area{routeList.length !== 1 ? "s" : ""}
                {activeGames.length > 0 ? ` · ${activeGames.map((g) => GAME_LABELS[g] ?? g).join(", ")}` : ""}
              </div>
            )}
          </div>

          {/* ── Map view (Gen 4 only) ── */}
          {activeGeneration === 4 && viewMode === "map" ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl overflow-hidden border border-gray-700/60 relative" style={{ height: 520 }}>
                {showHGSSMap ? (
                  <HGSSMap
                    routeIndex={routeIndex}
                    activeRoute={activeRoute}
                    onRouteClick={handleMapRouteClick}
                    searchQuery={search}
                    activeGeneration={activeGeneration}
                  />
                ) : (
                  <SinnohMap
                    routeIndex={routeIndex}
                    activeRoute={activeRoute}
                    onRouteClick={handleMapRouteClick}
                    searchQuery={search}
                    activeGeneration={activeGeneration}
                  />
                )}
              </div>
              {selectedRoute && (
                <div ref={routeDetailRef} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Click a region on the map to change location</span>
                    <button
                      onClick={() => setActiveRoute(null)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      ✕ Close
                    </button>
                  </div>
                  {isGreatMarshSlug(selectedRoute.slug) && (
                    <GreatMarshBanner allPokemon={allPokemon} activeGeneration={activeGeneration} />
                  )}
                  <RouteDetail route={selectedRoute} orderedGames={orderedGames} activeGeneration={activeGeneration} />
                </div>
              )}
              {!selectedRoute && (
                <div className="text-center py-6 text-gray-600 text-sm italic">Click a region on the map to view Pokémon</div>
              )}
            </div>
          ) : (
            /* ── List view ── */
            selectedRoute ? (
              <div className="flex flex-col gap-6">
                {isGreatMarshSlug(selectedRoute.slug) && (
                  <GreatMarshBanner allPokemon={allPokemon} activeGeneration={activeGeneration} />
                )}
                <RouteDetail route={selectedRoute} orderedGames={orderedGames} activeGeneration={activeGeneration} />
              </div>
            ) : (
              routeList.length === 0 ? (
                <div className="text-center py-16 text-gray-500 text-sm italic">No routes found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {routeList.map((route) => (
                    <button
                      key={route.slug}
                      onClick={() => setActiveRoute(route.slug)}
                      className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-indigo-600 hover:bg-gray-800/60 transition-all text-left group"
                    >
                      <span className="text-sm font-medium text-gray-200 group-hover:text-white truncate">
                        {route.displayName}
                      </span>
                      <div className="flex gap-1 ml-2 flex-shrink-0">
                        {route.versions
                          .filter((v) => ALL_GAME_ORDER.includes(v as GameVersion))
                          .sort((a, b) => ALL_GAME_ORDER.indexOf(a as GameVersion) - ALL_GAME_ORDER.indexOf(b as GameVersion))
                          .map((v) => (
                            <span
                              key={v}
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: GAME_COLORS[v as GameVersion] ?? "#6b7280" }}
                              title={GAME_LABELS[v as GameVersion] ?? v}
                            />
                          ))}
                      </div>
                    </button>
                  ))}
                </div>
              )
            )
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Route Detail ──────────────────────────────────────────────────────────────

type PokemonRow = {
  pokemonId: number;
  displayName: string;
  types: string[];
  sprite: string;
  timeOfDay?: "morning" | "day" | "night";
  byGame: Map<string, RouteEntry>;
};

const SLOT2_METHOD_SET = new Set<EncounterMethod>([
  "slot2", "slot2-ruby", "slot2-sapphire", "slot2-emerald", "slot2-firered", "slot2-leafgreen",
]);

function RouteDetail({
  route,
  orderedGames,
  activeGeneration,
}: {
  route: RouteData;
  orderedGames: GameVersion[];
  activeGeneration: number;
}) {
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);
  const setActivePokedexId = useSettingsStore((s) => s.setActivePokedexId);
  const isCaught = useDexStore((s) => s.isCaught);
  const setCaught = useDexStore((s) => s.setCaught);

  const methodsPresent = useMemo(() => {
    const seen = new Set<EncounterMethod>();
    for (const [version, methodMap] of route.games) {
      if (orderedGames.length > 0 && !orderedGames.includes(version as GameVersion)) continue;
      for (const method of methodMap.keys()) seen.add(method);
    }
    return METHOD_ORDER.filter((m) => seen.has(m));
  }, [route, orderedGames]);

  // Pre-compute all method data in one memo so getMethodData doesn't rebuild Maps on every render.
  const allMethodData = useMemo(() => {
    const result = new Map<EncounterMethod, PokemonRow[]>();

    for (const method of methodsPresent) {
      const byPokemon = new Map<string, PokemonRow>();

      for (const game of orderedGames) {
        const methodMap = route.games.get(game);
        if (!methodMap) continue;
        const entries = methodMap.get(method) ?? [];
        for (const entry of entries) {
          // Use composite key so same Pokémon at different times-of-day stays as separate rows
          const rowKey = `${entry.pokemonId}:${entry.timeOfDay ?? ""}`;
          if (!byPokemon.has(rowKey)) {
            byPokemon.set(rowKey, {
              pokemonId: entry.pokemonId,
              displayName: entry.displayName,
              types: entry.types,
              sprite: entry.sprite,
              ...(entry.timeOfDay ? { timeOfDay: entry.timeOfDay } : {}),
              byGame: new Map(),
            });
          }
          byPokemon.get(rowKey)!.byGame.set(game, entry);
        }
      }

      const sorted = Array.from(byPokemon.values()).sort((a, b) => {
        const aMax = Math.max(...Array.from(a.byGame.values()).map((e) => e.totalChance));
        const bMax = Math.max(...Array.from(b.byGame.values()).map((e) => e.totalChance));
        return bMax !== aMax ? bMax - aMax : a.pokemonId - b.pokemonId;
      });

      result.set(method, sorted);
    }

    return result;
  }, [route, orderedGames, methodsPresent]);

  // Build the display sections: non-slot2 as-is; slot2 methods deduplicated by unique species set.
  const displaySections = useMemo(() => {
    type Section = { key: string; label: string; icon: string; rows: PokemonRow[] };
    const walkIds = new Set((allMethodData.get("walk") ?? []).map((r) => r.pokemonId));
    const sections: Section[] = [];
    const seenSlot2Sigs = new Set<string>();

    for (const method of methodsPresent) {
      const rows = allMethodData.get(method) ?? [];
      if (rows.length === 0) continue;

      if (!SLOT2_METHOD_SET.has(method)) {
        sections.push({ key: method, label: METHOD_LABELS[method] ?? method, icon: METHOD_ICONS[method] ?? "•", rows });
        continue;
      }

      // Slot2: skip if it adds no species beyond what walking already has.
      const uniqueIds = rows
        .filter((r) => !walkIds.has(r.pokemonId))
        .map((r) => r.pokemonId)
        .sort((a, b) => a - b);
      if (uniqueIds.length === 0) continue;

      const sig = uniqueIds.join(",");
      if (seenSlot2Sigs.has(sig)) continue;
      seenSlot2Sigs.add(sig);

      // Gather all slot2 methods that produce the same unique species set, then merge their rows.
      const groupMethods = methodsPresent.filter((m) => {
        if (!SLOT2_METHOD_SET.has(m)) return false;
        const mIds = (allMethodData.get(m) ?? [])
          .filter((r) => !walkIds.has(r.pokemonId))
          .map((r) => r.pokemonId)
          .sort((a, b) => a - b)
          .join(",");
        return mIds === sig;
      });

      // Merge byGame maps across all methods in the group so per-game columns stay accurate.
      const mergedById = new Map<number, PokemonRow>();
      for (const m of groupMethods) {
        for (const row of allMethodData.get(m) ?? []) {
          if (!mergedById.has(row.pokemonId)) {
            mergedById.set(row.pokemonId, { ...row, byGame: new Map(row.byGame) });
          } else {
            const existing = mergedById.get(row.pokemonId)!;
            for (const [game, entry] of row.byGame) existing.byGame.set(game, entry);
          }
        }
      }
      const mergedRows = Array.from(mergedById.values()).sort((a, b) => {
        const aMax = Math.max(...Array.from(a.byGame.values()).map((e) => e.totalChance));
        const bMax = Math.max(...Array.from(b.byGame.values()).map((e) => e.totalChance));
        return bMax !== aMax ? bMax - aMax : a.pokemonId - b.pokemonId;
      });

      const gameNames = groupMethods.map((m) =>
        (METHOD_LABELS[m] ?? m).replace(/^Slot 2 \(/, "").replace(/\)$/, "")
      );
      const label = groupMethods.length === 1
        ? (METHOD_LABELS[method] ?? method)
        : `Slot 2 (${gameNames.join(" / ")})`;

      sections.push({ key: `slot2-${sig}`, label, icon: "🎮", rows: mergedRows });
    }

    return sections;
  }, [allMethodData, methodsPresent]);

  function isUniform(rows: { byGame: Map<string, RouteEntry> }[]): boolean {
    if (orderedGames.length <= 1) return true;
    for (const row of rows) {
      const values = orderedGames.map((g) => {
        const e = row.byGame.get(g);
        return e ? `${e.minLevel}-${e.maxLevel}-${e.totalChance}-${e.isStatic}` : "absent";
      });
      if (new Set(values).size > 1) return false;
    }
    return true;
  }

  // Compute unique Pokémon across all encounter methods for the completion badge
  const uniqueIds = useMemo(() => {
    const ids = new Set<number>();
    for (const methodMap of route.games.values()) {
      for (const entries of methodMap.values()) {
        for (const e of entries) ids.add(e.pokemonId);
      }
    }
    return ids;
  }, [route]);
  const caughtCount = useMemo(() => [...uniqueIds].filter((id) => isCaught(id, activeGeneration)).length, [uniqueIds, isCaught, activeGeneration]);

  return (
    <div className="flex flex-col gap-6">
      {/* Route header */}
      <div className="pb-4 border-b border-gray-800">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-2xl font-bold text-white">{route.displayName}</h2>
          {uniqueIds.size > 0 && (
            <span className={`text-sm font-medium tabular-nums ${caughtCount === uniqueIds.size ? "text-green-400" : "text-indigo-400"}`}>
              {caughtCount}/{uniqueIds.size} caught
            </span>
          )}
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {route.versions
            .filter((v) => ALL_GAME_ORDER.includes(v as GameVersion))
            .sort((a, b) => ALL_GAME_ORDER.indexOf(a as GameVersion) - ALL_GAME_ORDER.indexOf(b as GameVersion))
            .map((v) => (
              <span
                key={v}
                className="px-2 py-0.5 rounded text-xs font-bold text-white"
                style={{ backgroundColor: GAME_COLORS[v as GameVersion] ?? "#6b7280" }}
              >
                {GAME_LABELS[v as GameVersion] ?? v}
              </span>
            ))}
        </div>
      </div>

      {displaySections.length === 0 ? (
        <div className="text-gray-500 text-sm italic">No encounter data for selected games.</div>
      ) : (
        displaySections.map(({ key, label, icon, rows }) => {
          if (rows.length === 0) return null;
          const uniform = isUniform(rows);
          const showPerGame = !uniform && orderedGames.length > 1;

          return (
            <section key={key}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
                <span className="text-lg">{icon}</span>
                <h3 className="text-base font-semibold text-gray-100">
                  {label}
                </h3>
              </div>

              <div className="rounded-lg overflow-hidden border border-gray-700/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/80 text-xs text-gray-400">
                      <th className="text-left py-2 pl-3 pr-1 w-6">{/* caught */}</th>
                      <th className="text-left py-2 pl-1 pr-2 w-8">{/* sprite */}</th>
                      <th className="text-left py-2 px-2 min-w-[120px]">Pokémon</th>
                      <th className="text-left py-2 px-2 hidden sm:table-cell">Type</th>
                      {showPerGame
                        ? orderedGames.map((g) => (
                            <th
                              key={g}
                              colSpan={2}
                              className="text-center py-2 px-2 border-l border-gray-700/40"
                            >
                              <span
                                className="px-1.5 py-0.5 rounded text-xs font-bold text-white"
                                style={{ backgroundColor: GAME_COLORS[g] ?? "#6b7280" }}
                              >
                                {GAME_LABELS[g]}
                              </span>
                            </th>
                          ))
                        : (
                          <>
                            <th className="text-right py-2 px-2 border-l border-gray-700/40">Levels</th>
                            <th className="text-right py-2 pl-2 pr-3">Rate</th>
                          </>
                        )}
                    </tr>
                    {showPerGame && (
                      <tr className="bg-gray-800/50 text-xs text-gray-500">
                        <th colSpan={4} />
                        {orderedGames.map((g) => (
                          <Fragment key={g}>
                            <th className="text-right py-1 px-2 border-l border-gray-700/40 font-normal">Levels</th>
                            <th className="text-right py-1 pl-2 pr-3 font-normal">Rate</th>
                          </Fragment>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const anyEntry = orderedGames.map((g) => row.byGame.get(g)).find(Boolean);
                      const caught = isCaught(row.pokemonId, activeGeneration);
                      return (
                        <tr
                          key={`${row.pokemonId}:${row.timeOfDay ?? ""}`}
                          className={`border-t border-gray-700/30 transition-colors ${i % 2 === 0 ? "" : "bg-gray-900/30"} ${caught ? "opacity-60" : ""}`}
                        >
                          <td className="py-1.5 pl-3 pr-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={caught}
                              onChange={() => setCaught(row.pokemonId, !caught, activeGeneration)}
                              className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0 cursor-pointer"
                              aria-label={`Mark ${row.displayName} as caught`}
                            />
                          </td>
                          <td
                            className="py-1.5 pl-1 pr-1 cursor-pointer hover:bg-indigo-900/20"
                            onClick={() => { setActiveTab("pokedex"); setActivePokedexId(row.pokemonId); }}
                          >
                            <img
                              src={row.sprite}
                              alt={row.displayName}
                              loading="lazy"
                              className="w-8 h-8 object-contain"
                              style={{ imageRendering: "pixelated" }}
                            />
                          </td>
                          <td
                            className="py-1.5 px-2 cursor-pointer hover:bg-indigo-900/20"
                            onClick={() => { setActiveTab("pokedex"); setActivePokedexId(row.pokemonId); }}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-medium text-sm ${caught ? "line-through text-gray-500" : "text-gray-100"}`}>{row.displayName}</span>
                              <span className="text-xs text-gray-600 font-mono">#{formatDexNumber(row.pokemonId)}</span>
                              {row.timeOfDay && (
                                <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-gray-700 text-gray-300 whitespace-nowrap">
                                  {row.timeOfDay === "morning" ? "🌅" : row.timeOfDay === "day" ? "☀️" : "🌙"}{" "}
                                  {row.timeOfDay.charAt(0).toUpperCase() + row.timeOfDay.slice(1)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="py-1.5 px-2 hidden sm:table-cell cursor-pointer hover:bg-indigo-900/20"
                            onClick={() => { setActiveTab("pokedex"); setActivePokedexId(row.pokemonId); }}
                          >
                            <div className="flex gap-1 flex-wrap">
                              {row.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                            </div>
                          </td>
                          {showPerGame
                            ? orderedGames.map((g) => {
                                const entry = row.byGame.get(g);
                                return (
                                  <Fragment key={g}>
                                    <td className="py-1.5 px-2 text-right text-gray-300 font-mono text-xs border-l border-gray-700/30">
                                      {entry ? (entry.isStatic ? "—" : entry.minLevel === entry.maxLevel ? `${entry.minLevel}` : `${entry.minLevel}–${entry.maxLevel}`) : <span className="text-gray-700">—</span>}
                                    </td>
                                    <td className="py-1.5 pl-2 pr-3 text-right text-xs">
                                      {entry ? <RateCell entry={entry} /> : <span className="text-gray-700">—</span>}
                                    </td>
                                  </Fragment>
                                );
                              })
                            : anyEntry
                            ? (
                              <>
                                <td className="py-1.5 px-2 text-right text-gray-300 font-mono text-xs border-l border-gray-700/30">
                                  {anyEntry.isStatic ? "—" : anyEntry.minLevel === anyEntry.maxLevel ? `${anyEntry.minLevel}` : `${anyEntry.minLevel}–${anyEntry.maxLevel}`}
                                </td>
                                <td className="py-1.5 pl-2 pr-3 text-right text-xs">
                                  <RateCell entry={anyEntry} />
                                </td>
                              </>
                            )
                            : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

// ─── Rate Cell ─────────────────────────────────────────────────────────────────

function RateCell({ entry }: { entry: RouteEntry }) {
  if (entry.isStatic || entry.totalChance === 0) {
    return <span className="text-purple-400 font-medium">1×</span>;
  }
  const cls =
    entry.totalChance >= 20 ? "text-green-400" :
    entry.totalChance >= 10 ? "text-yellow-400" :
    "text-red-400";
  return <span className={`font-medium ${cls}`}>{entry.totalChance}%</span>;
}
