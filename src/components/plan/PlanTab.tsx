import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { BookOpenText, CalendarDays, Compass, Gem, ListTodo, Sparkles, StickyNote, TrendingUp } from "lucide-react";
import type { MetaData, PlanSection, Pokemon } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import { useWorkingOnStore } from "../../store/useWorkingOnStore";
import { useHuntStore } from "../../store/useHuntStore";
import { orderedItems } from "../../lib/working-on";
import { liveEntries } from "../../lib/entries";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import SectionLayout, { type SectionGroup } from "../layout/SectionLayout";
import DetailHost from "../detail-panel/DetailHost";
import { PokemonPanelContext } from "../shared/pokemon-panel";
import WorkingOnPanel from "../notes/WorkingOnPanel";
import AllNotesPanel from "../notes/AllNotesPanel";
import JournalPanel from "../notes/JournalPanel";
import DailyChecklist from "../tracker/DailyChecklist";
import WhatNextView from "../tracker/WhatNextView";

// The bigger tools are chunks of their own, loaded the first time their section opens
const LevelUpView = lazy(() => import("../tracker/LevelUpView"));
const ShoppingListView = lazy(() => import("../tracker/ShoppingListView"));
const ShinyHuntView = lazy(() => import("../tracker/ShinyHuntView"));

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

const NO_IDS: number[] = [];

/**
 * The Plan tab: what to do next — today's events, where to go, who to level up, which
 * evolution items to get — and what you keep track of: the Working on list, your notes, the
 * journal and shiny hunts. A Pokémon opened here shows its details beside the section.
 */
export default function PlanTab({ allPokemon, meta }: Props) {
  const section = useSettingsStore((s) => s.planSection);
  const setSection = useSettingsStore((s) => s.setPlanSection);
  const generation = useSettingsStore((s) => s.activeGeneration);
  const caught = useDexStore((s) => s.caughtByGen[generation]) ?? NO_IDS;
  const pending = useDexStore((s) => s.pendingByGen[generation]) ?? NO_IDS;

  // Cheap counts for the sidebar: open Working on items, hunts still going
  const workEntries = useWorkingOnStore((s) => s.entries);
  const openItems = useMemo(() => orderedItems(workEntries).filter((i) => i.status !== "done").length, [workEntries]);
  const huntEntries = useHuntStore((s) => s.entries);
  const activeHunts = useMemo(
    () => liveEntries(huntEntries).filter(([, h]) => h.generation === generation && h.foundAt === undefined).length,
    [huntEntries, generation],
  );

  const groups: SectionGroup<PlanSection>[] = [
    {
      label: "Do next",
      items: [
        {
          id: "today",
          label: "Today",
          Icon: CalendarDays,
          description: "Daily and weekly events, and the roaming legendaries",
        },
        {
          id: "where",
          label: "Where to go",
          Icon: Compass,
          description: "Places ranked by how many Pokémon you still need there",
        },
        {
          id: "level",
          label: "Level up",
          Icon: TrendingUp,
          description: "Pending Pokémon that only need levels, and where to get EXP",
        },
        { id: "items", label: "Items to get", Icon: Gem, description: "Evolution items for what you've caught" },
      ],
    },
    {
      label: "Keep track",
      items: [
        {
          id: "working",
          label: "Working on",
          Icon: ListTodo,
          description: "Your to-do list",
          badge: openItems > 0 ? openItems : undefined,
        },
        { id: "notes", label: "Notes", Icon: StickyNote, description: "Every note on a Pokémon, in one list" },
        { id: "journal", label: "Journal", Icon: BookOpenText, description: "A diary of your runs" },
        {
          id: "hunts",
          label: "Shiny hunts",
          Icon: Sparkles,
          description: "Encounter counters and odds",
          badge: activeHunts > 0 ? activeHunts : undefined,
        },
      ],
    },
  ];

  // A section stays mounted once opened, so its scroll, ticks and search survive switching
  const [visited, setVisited] = useState<ReadonlySet<PlanSection>>(() => new Set([section]));
  if (!visited.has(section)) setVisited(new Set([...visited, section]));

  // Pokémon opened from here show beside the section, not in the tracker
  const [shownId, setShownId] = useState<number | null>(null);
  const wide = useMediaQuery("(min-width: 1280px)");

  const slot = (id: PlanSection, content: ReactNode, opts: { padded?: boolean; wide?: boolean } = {}) =>
    visited.has(id) && (
      <div key={id} className={section === id ? "flex flex-col flex-1 min-h-0" : "hidden"}>
        {opts.padded === false ? (
          content
        ) : (
          <main className="flex-1 min-h-0 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom,0px))] roomy:pb-[env(safe-area-inset-bottom,0px)]">
            <div
              className={`${opts.wide ? "max-w-screen-2xl" : "max-w-5xl"} mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 flex flex-col gap-4`}
            >
              {content}
            </div>
          </main>
        )}
      </div>
    );

  const heading = (title: string, subtitle: string) => (
    <div>
      <h1 className="text-xl font-bold text-white" style={{ fontFamily: "var(--theme-font-display)" }}>
        {title}
      </h1>
      <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
    </div>
  );

  return (
    <PokemonPanelContext.Provider value={setShownId}>
      <SectionLayout
        ariaLabel="Plan sections"
        groups={groups}
        active={section}
        onSelect={setSection}
        forceRail={shownId !== null && !wide}
      >
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 flex flex-col">
            {slot(
              "today",
              <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <DailyChecklist allPokemon={allPokemon} />
              </main>,
              { padded: false },
            )}
            {slot(
              "where",
              <WhatNextView allPokemon={allPokemon} meta={meta} caughtIds={caught} pendingIds={pending} />,
              { wide: true },
            )}
            {slot(
              "level",
              <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
                <LevelUpView allPokemon={allPokemon} />
              </Suspense>,
            )}
            {slot(
              "items",
              <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
                <ShoppingListView allPokemon={allPokemon} caughtIds={caught} />
              </Suspense>,
            )}
            {slot(
              "working",
              <>
                {heading("Working on", "What you're doing next, linked to its Pokémon, places and games.")}
                <WorkingOnPanel allPokemon={allPokemon} />
              </>,
            )}
            {slot(
              "notes",
              <>
                {heading("Notes", "Every note you've written on a Pokémon in this generation.")}
                <AllNotesPanel allPokemon={allPokemon} />
              </>,
            )}
            {slot(
              "journal",
              <>
                {heading("Journal", "A diary of your runs, by day and game.")}
                <JournalPanel allPokemon={allPokemon} />
              </>,
            )}
            {slot(
              "hunts",
              <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
                <ShinyHuntView allPokemon={allPokemon} />
              </Suspense>,
            )}
          </div>
          <DetailHost allPokemon={allPokemon} pokemonId={shownId} onClose={() => setShownId(null)} />
        </div>
      </SectionLayout>
    </PokemonPanelContext.Provider>
  );
}
