import AddSpotButton from "../notes/AddSpotButton";
import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Lock, Printer, SlidersHorizontal, Star } from "lucide-react";
import type { GameVersion, MetaData, Pokemon } from "../../types";
import { GAME_ABBR, GAME_LABELS } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import {
  buildNextLocations,
  onlySpecial,
  byReach,
  METHOD_GROUPS,
  methodGroupOf,
  methodGroupsText,
  type NextLocation,
  onlyInGame,
  SETUP_METHODS,
  whenText,
} from "../../lib/what-next";
import { useGameProgressStore } from "../../store/useGameProgressStore";
import { useSoleSourceStore } from "../../store/useSoleSourceStore";
import { requirementText } from "../../lib/unlocks";
import { byEffort, effortText, routeEffort } from "../../lib/trip";
import { METHOD_ORDER, METHOD_LABELS, METHOD_ICONS } from "../../hooks/useRouteIndex";
import { getGenSprite } from "../../lib/pokemon-display";
import { openMyGames, openRoute } from "../../lib/navigate";
import { describeClock } from "../../lib/available-now";
import { useClock } from "../../hooks/useClock";
import { PokemonLink } from "../shared/links";
import { useSaveStore } from "../../store/useSaveStore";
import { genConfigOf } from "../../lib/save/types";
import { areaDisplayName } from "../../lib/area-names";
import { GameChip } from "../shared/GameChip";
import WhatNextPrint from "./WhatNextPrint";
import TripCheckOff from "./TripCheckOff";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { OptionRow, Pill, SELECT, SelectField } from "../shared/OptionControls";
import { extraCopies } from "../../lib/evolution-status";

/** "Houndoom", "Vileplume / Bellossom", "7 evolutions" — fits under a tile */
const extraLabel = (steps: readonly { displayName: string }[]) =>
  steps.length <= 2 ? steps.map((s) => s.displayName).join(" / ") : `${steps.length} evolutions`;

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  caughtIds: number[];
  pendingIds: number[];
}

const PAGE_SIZE = 40;

function levelLabel(min: number, max: number): string {
  return min === max ? `Lv. ${min}` : `Lv. ${min}–${max}`;
}

/**
 * Plan → Where to go (once the tracker's "What can I get next"): places in the selected games,
 * ranked by how many Pokémon you haven't caught yet can be found there. On a wide screen the
 * places are a list beside the chosen one; narrower, each place is a card. Printing and trips
 * are behind "Plan a trip", so the list isn't covered in checkboxes the rest of the time.
 */
export default function WhatNextView(props: Props) {
  return <CatchNext {...props} />;
}

function CatchNext({ allPokemon, meta, caughtIds, pendingIds }: Props) {
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
  const methodChoice = useSettingsStore((s) => s.nextMethods);
  const setMethods = useSettingsStore((s) => s.setNextMethods);
  const hidePending = useSettingsStore((s) => s.nextHidePending);
  const setHidePending = useSettingsStore((s) => s.setNextHidePending);
  const includeSpecial = useSettingsStore((s) => s.nextIncludeSpecial);
  const setIncludeSpecial = useSettingsStore((s) => s.setNextIncludeSpecial);
  const extraOn = useSettingsStore((s) => s.nextExtraCopies);
  const setExtraOn = useSettingsStore((s) => s.setNextExtraCopies);
  const clock = useClock();
  const [shown, setShown] = useState(PAGE_SIZE);
  // The options panel, folded by default (this device, this visit)
  const [optionsOpen, setOptionsOpen] = useState(false);
  // "Plan a trip": checkboxes on the places, and the print / check-off bar
  const [tripMode, setTripMode] = useState(false);
  // Routes ticked for printing — this device only, gone on reload
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // Wide screens: the places as a list beside the one open
  const split = useMediaQuery("(min-width: 1280px)");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const toggle = (slug: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  // A living-dex save of this generation has its own, more specific to-do list
  const hasLivingDex = useSaveStore((s) =>
    s.profiles.some((p) => p.role === "living-dex" && genConfigOf(p.family).gen === activeGeneration),
  );
  const openTodo = () => openMyGames("saves", "todo");

  const genMeta = meta.generations.find((g) => g.id === activeGeneration);

  const games: string[] = useMemo(
    () => (activeGames.length > 0 ? activeGames : (genMeta?.versions ?? [])),
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

  // The method groups the selected games have at all (Honey trees only in D/P/Pt, …)
  const groupsHere = useMemo(() => {
    const seen = new Set<string>();
    for (const p of genPokemon) {
      for (const e of p.encounters) {
        if (!games.includes(e.version)) continue;
        for (const l of e.locations)
          for (const d of l.details) {
            if (d.method === "trade" || (!includeSetup && SETUP_METHODS.has(d.method))) continue;
            seen.add(methodGroupOf(d.method));
          }
      }
    }
    return METHOD_GROUPS.filter((g) => seen.has(g.id));
  }, [genPokemon, games, includeSetup]);
  // A chosen group these games don't have is ignored; none left = every method
  const methods = useMemo(
    () => methodChoice.filter((id) => groupsHere.some((g) => g.id === id)),
    [methodChoice, groupsHere],
  );
  // The first chip tapped narrows to that group; more taps add groups; "All" (or untapping the last) clears
  const toggleMethod = (id: string) =>
    setMethods(methods.includes(id) ? methods.filter((m) => m !== id) : [...methods, id]);
  const methodLabel = methodGroupsText(methods);

  // Caught Pokémon whose evolution isn't caught or pending: one more to catch, to evolve (Houndour for Houndoom)
  const extra = useMemo(
    () =>
      extraOn && genMeta
        ? extraCopies(genPokemon, new Set(caughtIds), new Set(pendingIds), genMeta.pokemonRange[1], games)
        : new Map<number, never[]>(),
    [extraOn, genMeta, genPokemon, caughtIds, pendingIds, games],
  );

  // Every location, fully caught ones too (the print can include them)
  // What counts as had: caught, plus pending when those are hidden; a Pokémon needed again to evolve is one to catch
  const have = useMemo(() => {
    const out = new Set(hidePending ? [...caughtIds, ...pendingIds] : caughtIds);
    for (const id of extra.keys()) out.delete(id);
    return out;
  }, [caughtIds, pendingIds, hidePending, extra]);
  // With the Safari Zone and contest left out: the Pokémon still to catch that are found only there, now hidden
  const hiddenBySpecial = useMemo(
    () =>
      includeSpecial || !games.some((g) => g === "heartgold" || g === "soulsilver")
        ? []
        : onlySpecial(genPokemon, onlyGame ? [onlyGame] : games, have),
    [includeSpecial, games, onlyGame, genPokemon, have],
  );

  const allLocations = useMemo(() => {
    if (!genMeta) return [];
    // Pending ones count as had (nothing left to catch), and are then taken off the lists altogether
    const pending = new Set(hidePending ? pendingIds : []);
    const withoutPending = (list: NextLocation[]): NextLocation[] =>
      pending.size === 0
        ? list
        : list.map((l) => {
            const byMethod = l.byMethod
              .map((m) => ({ ...m, targets: m.targets.filter((t) => !pending.has(t.pokemon.id)) }))
              .filter((m) => m.targets.length > 0);
            return { ...l, byMethod, total: new Set(byMethod.flatMap((m) => m.targets.map((t) => t.pokemon.id))).size };
          });
    const built = buildNextLocations(genPokemon, games, have, includeSetup, nowOnly ? clock : undefined, {
      keepComplete: true,
      methodGroups: methods,
      excludeSpecial: !includeSpecial,
      secondCopies: new Set(extra.keys()),
    });
    const narrowed = onlyGame ? onlyInGame(withoutPending(built), onlyGame, true) : withoutPending(built);
    const progressOf = (g: string) => {
      const e = progressEntries[g];
      return e && !e.removed ? e : undefined;
    };
    const reached = reachOnly
      ? byReach(narrowed, progressOf, onlyGame ? [onlyGame] : games, lockedMode === "grey", true)
      : narrowed;
    return sort === "effort" ? byEffort(reached) : reached;
  }, [
    genPokemon,
    genMeta,
    games,
    have,
    pendingIds,
    hidePending,
    extra,
    includeSetup,
    nowOnly,
    clock,
    methods,
    includeSpecial,
    onlyGame,
    reachOnly,
    lockedMode,
    progressEntries,
    sort,
  ]);
  // On screen: places with something left to catch (or, greyed out, still to unlock)
  const locations = useMemo(
    () =>
      allLocations.filter((l) => l.count > 0 || l.byMethod.some((m) => m.targets.some((t) => t.locked && !t.caught))),
    [allLocations],
  );

  // The routes ticked here, as a trip to check off
  const tickedTrip = useMemo(
    () =>
      selected.size > 0
        ? {
            slugs: locations.filter((l) => selected.has(l.slug)).map((l) => l.slug),
            games: onlyGame ? [onlyGame] : games,
            setup: includeSetup,
            methods,
            special: includeSpecial,
          }
        : null,
    [selected, locations, onlyGame, games, includeSetup, methods, includeSpecial],
  );

  const gameLabel =
    activeGames.length > 0 ? activeGames.map((g) => GAME_LABELS[g]).join(", ") : `all ${genMeta?.name ?? ""} games`;
  const showGames = games.length > 1 && !onlyGame;
  // Options set away from their defaults, counted on the phone's folded Options button
  const changedOptions = [
    !showCaught,
    hidePending,
    !extraOn,
    nowOnly,
    includeSetup,
    !includeSpecial && games.some((g) => g === "heartgold" || g === "soulsilver"),
    methods.length > 0,
    !!onlyGame,
    reachOnly,
  ].filter(Boolean).length;

  // One place, with every method and Pokémon: a card in the list, or the open place beside the list
  const placeCard = (loc: NextLocation) => {
    const shownMethods = [...loc.byMethod]
      .map((m) => (showCaught ? m : { ...m, targets: m.targets.filter((t) => !t.caught) }))
      .filter((m) => m.targets.length > 0)
      .sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
    const best = showGames && loc.bestGame && Object.keys(loc.perGame).length > 1 ? loc.bestGame : null;
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-3" data-testid="place-card">
        <div className="flex items-center gap-2">
          {tripMode && tripBox(loc)}
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
            <span
              className="text-amber-300 font-medium mr-1.5"
              title="Pokémon you can get nowhere else in your games — counted double in the ranking"
            >
              <Star size={11} className="inline -mt-0.5 fill-current" aria-hidden="true" /> {loc.uniques} only here ·
            </span>
          )}
          {loc.total - loc.count} of {loc.total} caught
          {sort === "effort" && loc.count > 0 && <> · ~{routeEffort(loc)} encounters for the rest</>}
          {best && (
            <>
              {" · "}Best game:{" "}
              <span className="text-gray-200 font-medium">{GAME_ABBR[best as GameVersion] ?? best}</span> (
              {loc.perGame[best]} left)
            </>
          )}
        </p>
        {loc.note && <p className="mt-1.5 text-xs text-gray-400">{loc.note}</p>}
        <div className="mt-2 flex flex-col gap-2">
          {shownMethods.map(({ method, targets }) => (
            <div key={method} className="flex flex-col sm:flex-row items-start gap-1 sm:gap-2">
              <span className="sm:w-28 flex-shrink-0 text-xs text-gray-400 sm:pt-2">
                {METHOD_ICONS[method] ? `${METHOD_ICONS[method]} ` : ""}
                {METHOD_LABELS[method] ?? method}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {targets.map((t) => {
                  const detail = [
                    levelLabel(t.minLevel, t.maxLevel),
                    whenText(t),
                    t.caught ? "" : effortText(t),
                    showGames ? t.games.map((g) => GAME_LABELS[g as GameVersion] ?? g).join(", ") : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const lockText = t.locked
                    ? `${t.locked.missing.map((r) => requirementText(r, t.locked!.game)).join(", ")} (${GAME_ABBR[t.locked.game as GameVersion] ?? t.locked.game})`
                    : "";
                  return (
                    <div
                      key={t.pokemon.id}
                      title={`${t.pokemon.displayName}${t.caught ? " (caught)" : ""} — ${detail}${lockText ? ` — unlocks at: ${lockText}` : ""}${t.unique ? " — nowhere else in your games" : ""}`}
                      data-caught={t.caught || undefined}
                      data-locked={t.locked ? true : undefined}
                      className={`relative flex flex-col items-center w-[4.5rem] lg:w-24 rounded-lg px-1 py-1 ${
                        t.caught || t.locked ? "bg-gray-800/30 opacity-50" : "bg-gray-800/60"
                      }`}
                    >
                      {t.unique && !t.caught && (
                        <span className="absolute top-0.5 left-0.5 text-amber-300" aria-label="Only here">
                          <Star size={11} className="fill-current" aria-hidden="true" />
                        </span>
                      )}
                      {t.caught && (
                        <span
                          className="absolute top-0.5 right-0.5 rounded-full bg-emerald-600 text-white p-0.5"
                          aria-label="Caught"
                        >
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
                      {/* The name, so a sprite needn't be recognised on sight */}
                      <span className="w-full truncate text-center text-xs text-gray-100 leading-tight">
                        {t.pokemon.displayName}
                      </span>
                      <span className="text-xs text-gray-300 leading-tight tabular-nums">
                        {levelLabel(t.minLevel, t.maxLevel)}
                        {rateLabel(t) && <span className="text-gray-400"> · {rateLabel(t)}</span>}
                      </span>
                      {t.times.length > 0 && (
                        <span className="text-xs text-indigo-300 leading-tight">{t.times.join("/")}</span>
                      )}
                      {t.secondCopy && extra.has(t.pokemon.id) && (
                        <span
                          className="mt-0.5 text-xs font-medium text-emerald-300 leading-tight text-center"
                          data-testid="extra-copy"
                          title={`You have ${t.pokemon.displayName} — catch another to evolve into ${extra
                            .get(t.pokemon.id)!
                            .map((s) => `${s.displayName} (${s.details})`)
                            .join(" or ")}`}
                        >
                          for {extraLabel(extra.get(t.pokemon.id)!)}
                        </span>
                      )}
                      {t.daily && (
                        <span
                          className="text-[11px] text-amber-300 leading-tight"
                          title={
                            t.daily === "trophy-garden"
                              ? "Only on the days Mr. Backlot mentions it"
                              : "Only on the days it shows in the binoculars"
                          }
                        >
                          daily
                        </span>
                      )}
                      {showGames && (
                        <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                          {t.games.map((g) => (
                            <GameChip key={g} game={g as GameVersion} size="xs">
                              {GAME_ABBR[g as GameVersion] ?? g}
                            </GameChip>
                          ))}
                        </span>
                      )}
                      {lockText && (
                        <span className="mt-0.5 text-xs text-gray-400 leading-tight text-center">
                          <Lock size={9} className="inline -mt-0.5" aria-hidden="true" /> {lockText}
                        </span>
                      )}
                      {(t.onlyIn ?? soleSources.get(t.pokemon.id)) && !t.caught && (
                        <span className="mt-0.5 text-xs font-semibold text-amber-300 leading-tight">
                          Only in {GAME_ABBR[(t.onlyIn ?? soleSources.get(t.pokemon.id)) as GameVersion]}
                        </span>
                      )}
                      {!t.caught && (
                        <AddSpotButton
                          pokemonId={t.pokemon.id}
                          displayName={t.pokemon.displayName}
                          generation={activeGeneration}
                          route={{ slug: loc.slug, name: areaDisplayName(loc.displayName) }}
                          games={t.games as GameVersion[]}
                          method={METHOD_LABELS[method] ?? method}
                          rate={whenText(t) || undefined}
                          evolveTo={
                            t.secondCopy && extra.get(t.pokemon.id)?.[0]
                              ? {
                                  id: extra.get(t.pokemon.id)![0].speciesId,
                                  displayName: extra.get(t.pokemon.id)![0].displayName,
                                }
                              : undefined
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // The trip checkbox for a place (only while planning a trip)
  const tripBox = (loc: NextLocation) => (
    <label
      className="flex items-center justify-center w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 -m-1.5 flex-shrink-0 cursor-pointer"
      title="Tick to print this route"
    >
      <input
        type="checkbox"
        checked={selected.has(loc.slug)}
        onChange={() => toggle(loc.slug)}
        aria-label={`Print ${areaDisplayName(loc.displayName)}`}
        className="w-4 h-4 accent-indigo-500"
      />
    </label>
  );

  // The place open beside the list (wide screens): the one picked, or the top of the list
  const openPlace = locations.find((l) => l.slug === openSlug) ?? locations[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[16rem]">
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: "var(--theme-font-display)" }}>
            Where to go
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Places in {gameLabel} with Pokémon you haven&apos;t caught, {sort === "effort" ? "easiest" : "most"} first.
            Tap a Pokémon for its details, or a place&apos;s name to open it in Routes.
          </p>
        </div>
        {hasLivingDex && (
          <button
            onClick={openTodo}
            className="px-3 min-h-[36px] pointer-coarse:min-h-11 rounded-lg border border-gray-700 hover:border-gray-500 text-xs text-gray-200 font-medium transition-colors"
          >
            Living-dex to-do list →
          </button>
        )}
      </div>

      {/* One row: how to rank, the folded options, and trip planning */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <span className="sr-only sm:not-sr-only">Rank</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "count" | "effort")}
            aria-label="Rank locations by"
            className={`${SELECT} w-auto`}
          >
            <option value="count">Most to catch</option>
            <option value="effort">Easiest first</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setOptionsOpen(!optionsOpen)}
          aria-expanded={optionsOpen}
          className="flex items-center gap-2 px-3 min-h-[36px] pointer-coarse:min-h-11 rounded-lg border border-gray-700 hover:border-gray-500 text-sm text-gray-200"
        >
          <SlidersHorizontal size={15} className="text-gray-400" aria-hidden="true" />
          Options
          {changedOptions > 0 && (
            <span className="px-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-semibold tabular-nums">
              {changedOptions}
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-gray-400 transition-transform ${optionsOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {nowOnly && !optionsOpen && (
          <span className="text-xs text-gray-400" data-testid="next-clock">
            On right now: {describeClock(clock)}
          </span>
        )}
        {locations.length > 0 && (
          <button
            type="button"
            onClick={() => setTripMode(!tripMode)}
            aria-pressed={tripMode}
            className={`ml-auto flex items-center gap-2 px-3 min-h-[36px] pointer-coarse:min-h-11 rounded-lg border text-sm transition-colors ${
              tripMode
                ? "border-indigo-500 text-indigo-200 bg-indigo-500/10"
                : "border-gray-700 hover:border-gray-500 text-gray-200"
            }`}
          >
            <Printer size={15} aria-hidden="true" />
            {tripMode ? "Done planning" : "Plan a trip"}
          </button>
        )}
      </div>

      {optionsOpen && (
        <div className="rounded-xl border border-gray-800 p-3 flex flex-col gap-2.5" data-testid="next-options">
          <OptionRow label="Show">
            <Pill on={showCaught} onClick={() => setShowCaught(!showCaught)}>
              Caught
            </Pill>
            <Pill
              on={!hidePending}
              onClick={() => setHidePending(!hidePending)}
              title="Pending ones only need levelling, evolving or moving — see Level up"
            >
              Pending{hidePending && pendingIds.length > 0 ? ` (${pendingIds.length} hidden)` : ""}
            </Pill>
            <Pill on={nowOnly} onClick={() => setNowOnly(!nowOnly)} testId="next-now">
              Only what&apos;s on right now
            </Pill>
            {nowOnly && (
              <span className="text-[11px] text-gray-500" data-testid="next-clock">
                {describeClock(clock)}
              </span>
            )}
          </OptionRow>
          <OptionRow label="Include">
            <Pill
              on={extraOn}
              onClick={() => setExtraOn(!extraOn)}
              title="A Pokémon you've caught whose evolution you haven't (and isn't pending): catch another to evolve, so you keep both"
            >
              Second copies to evolve{extraOn && extra.size > 0 ? ` (${extra.size})` : ""}
            </Pill>
            <Pill on={includeSetup} onClick={() => setIncludeSetup(!includeSetup)}>
              Outbreaks, Poké Radar, Slot 2, radio
            </Pill>
            {games.some((g) => g === "heartgold" || g === "soulsilver") && (
              <Pill on={includeSpecial} onClick={() => setIncludeSpecial(!includeSpecial)}>
                Safari Zone &amp; Bug-Catching Contest
              </Pill>
            )}
          </OptionRow>
          {groupsHere.length > 1 && (
            <OptionRow label="Methods" testId="next-methods" ariaLabel="Encounter methods">
              {[{ id: "all", label: "All" }, ...groupsHere].map((g) => (
                <Pill
                  key={g.id}
                  on={g.id === "all" ? methods.length === 0 : methods.includes(g.id)}
                  onClick={() => (g.id === "all" ? setMethods([]) : toggleMethod(g.id))}
                >
                  {g.label}
                </Pill>
              ))}
            </OptionRow>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t border-gray-800">
            {games.length > 1 && (
              <SelectField label="Game">
                <select
                  value={onlyGame ?? ""}
                  onChange={(e) => setOnlyGame(e.target.value || null)}
                  aria-label="Only show what I can get in this game"
                  className={SELECT}
                >
                  <option value="">Any selected game</option>
                  {games.map((g) => (
                    <option key={g} value={g}>
                      Only {GAME_LABELS[g as GameVersion] ?? g}
                    </option>
                  ))}
                </select>
              </SelectField>
            )}
            <SelectField label="Not reached yet" title="Uses your badges and milestones in Game progress">
              <select
                value={reachOnly ? lockedMode : "show"}
                onChange={(e) => {
                  const v = e.target.value;
                  setReachOnly(v !== "show");
                  if (v !== "show") setLockedMode(v as "hide" | "grey");
                }}
                aria-label="Places your Game progress hasn't reached"
                className={SELECT}
              >
                <option value="show">Show as usual</option>
                <option value="grey">Grey out</option>
                <option value="hide">Hide</option>
              </select>
            </SelectField>
          </div>
        </div>
      )}

      {tripMode && locations.length > 0 && (
        <div
          className="sticky top-0 z-10 px-3 py-2 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-500/40 bg-gray-950/95 backdrop-blur"
          data-testid="print-bar"
        >
          <WhatNextPrint
            locations={allLocations}
            games={onlyGame ? [onlyGame] : games}
            selected={selected}
            generation={activeGeneration}
            pokemon={genPokemon}
            caughtIds={caughtIds}
            showEffort={sort === "effort"}
            includeSetup={includeSetup}
            methods={methods}
            includeSpecial={includeSpecial}
            gameLabel={
              onlyGame
                ? (GAME_LABELS[onlyGame as GameVersion] ?? onlyGame)
                : activeGames.length > 0
                  ? gameLabel
                  : `All ${genMeta?.name ?? ""} games`
            }
            clockLabel={nowOnly ? describeClock(clock) : null}
            methodLabel={methodLabel}
          />
          <TripCheckOff pokemon={genPokemon} generation={activeGeneration} ticked={tickedTrip} />
          <button
            onClick={() => setSelected(new Set(locations.map((l) => l.slug)))}
            className="px-3 py-2 rounded-lg text-xs text-gray-300 hover:text-gray-100 hover:bg-gray-800"
          >
            Select all
          </button>
          <button
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
            className="px-3 py-2 rounded-lg text-xs text-gray-300 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-40"
          >
            Clear
          </button>
          <span className="text-xs text-gray-500">
            {selected.size === 0 ? "Tick routes to print only those." : `${selected.size} ticked`}
          </span>
        </div>
      )}

      {hiddenBySpecial.length > 0 && (
        <p
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400 rounded-lg border border-gray-800 px-3 py-2"
          data-testid="hidden-by-special"
        >
          <span>
            Left out with the Safari Zone and Bug-Catching Contest: {hiddenBySpecial.length} Pokémon you still need that{" "}
            {hiddenBySpecial.length === 1 ? "is" : "are"} found nowhere else —{" "}
            {hiddenBySpecial
              .slice(0, 8)
              .map((p) => p.displayName)
              .join(", ")}
            {hiddenBySpecial.length > 8 ? ` and ${hiddenBySpecial.length - 8} more` : ""}.
          </span>
          <button
            onClick={() => setIncludeSpecial(true)}
            className="px-2 py-1 rounded-md text-indigo-300 hover:text-indigo-200 hover:bg-gray-800 font-medium"
          >
            Include them
          </button>
        </p>
      )}

      {locations.length === 0 && (
        <p className="text-sm text-gray-400 italic py-6 text-center">
          Nothing left to find in {onlyGame ? (GAME_LABELS[onlyGame as GameVersion] ?? onlyGame) : gameLabel}
          {methodLabel ? ` by ${methodLabel.toLowerCase()}` : ""} with these settings.
        </p>
      )}

      {split && locations.length > 0 ? (
        <div className="flex gap-4 items-start">
          <ul
            className="w-80 flex-shrink-0 flex flex-col rounded-xl border border-gray-800 overflow-hidden"
            aria-label="Places"
          >
            {locations.slice(0, shown).map((loc, i) => {
              const open = loc.slug === openPlace?.slug;
              return (
                <li
                  key={loc.slug}
                  className="flex items-center border-b border-gray-800 last:border-b-0"
                  data-testid="place-row"
                  // Who is there, for finding a place by its Pokémon without opening it
                  data-pokemon={`|${loc.byMethod.flatMap((m) => m.targets.map((t) => t.pokemon.displayName)).join("|")}|`}
                >
                  {tripMode && <span className="pl-3">{tripBox(loc)}</span>}
                  <button
                    onClick={() => setOpenSlug(loc.slug)}
                    aria-current={open ? "true" : undefined}
                    className={`flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      open ? "bg-gray-800" : "hover:bg-gray-900"
                    }`}
                  >
                    <span className="w-5 text-xs text-gray-500 tabular-nums">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-100 truncate">
                        {areaDisplayName(loc.displayName)}
                      </span>
                      <span className="block text-xs text-gray-500 truncate">
                        {loc.uniques > 0 && <span className="text-amber-300">{loc.uniques} only here · </span>}
                        {loc.total - loc.count} of {loc.total} caught
                      </span>
                    </span>
                    <span className="text-base font-semibold tabular-nums text-gray-100">{loc.count}</span>
                    <ChevronRight size={14} className="text-gray-600" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
            {locations.length > shown && (
              <li>
                <button
                  onClick={() => setShown((n) => n + PAGE_SIZE)}
                  className="w-full px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-900"
                >
                  Show more ({locations.length - shown})
                </button>
              </li>
            )}
          </ul>
          <div className="flex-1 min-w-0 sticky top-0">{openPlace && placeCard(openPlace)}</div>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {locations.slice(0, shown).map((loc) => (
              <li key={loc.slug}>{placeCard(loc)}</li>
            ))}
          </ul>

          {locations.length > shown && (
            <button
              onClick={() => setShown((n) => n + PAGE_SIZE)}
              className="self-center px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
            >
              Show more ({locations.length - shown} more locations)
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** "5%" or "10–20%" (by time of day): the encounter rate on a card, when there is one */
function rateLabel(t: { rates: { min: number; max: number }[] }): string {
  if (t.rates.length === 0) return "";
  const lo = Math.min(...t.rates.map((r) => r.min));
  const hi = Math.max(...t.rates.map((r) => r.max));
  return lo === hi ? `${hi}%` : `${lo}–${hi}%`;
}
