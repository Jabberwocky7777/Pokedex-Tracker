import { useState } from "react";
import { CalendarDays, Zap, HelpCircle, BarChart3, ChevronDown, X, Compass, Gem, TrendingUp, Sparkles, Save, History } from "lucide-react";
import GameSelector from "../controls/GameSelector";
import ViewToggle from "../controls/ViewToggle";
import SearchBar from "../controls/SearchBar";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { AvailabilityMode, MetaData, Pokemon, ViewMode } from "../../types";
import ProgressBreakdown from "../tracker/ProgressBreakdown";
import AvailabilityHelp from "../tracker/AvailabilityHelp";

interface Props {
  meta: MetaData;
  /** Needed for the progress breakdown (tracker tab only). */
  allPokemon?: Pokemon[];
  caught: number;
  total: number;
  pending?: number;
  tab: "tracker" | "routes";
}

/**
 * Sticky filter sub-bar rendered below the top bar.
 * Tracker tab: desktop = single row, mobile = 3 stacked rows.
 * Routes tab: single GameSelector row.
 */
export default function FilterSubbar({ meta, allPokemon, caught, total, pending = 0, tab }: Props) {
  const quickMark = useSettingsStore((s) => s.quickMark);
  const setQuickMark = useSettingsStore((s) => s.setQuickMark);
  // Expandable strip under the filter rows: progress breakdown or availability help
  const [openPanel, setOpenPanel] = useState<"breakdown" | "help" | null>(null);
  const togglePanel = (panel: "breakdown" | "help") => setOpenPanel((p) => (p === panel ? null : panel));
  const quickMarkTitle = quickMark
    ? "Quick mark is on: a single tap or click toggles caught"
    : "Quick mark is off: tap opens details, double-click toggles caught";
  const viewMode = useSettingsStore((s) => s.viewMode);
  const setViewMode = useSettingsStore((s) => s.setViewMode);
  const dexMode = useSettingsStore((s) => s.dexMode);
  const setDexMode = useSettingsStore((s) => s.setDexMode);
  const availabilityMode = useSettingsStore((s) => s.availabilityMode);
  const setAvailabilityMode = useSettingsStore((s) => s.setAvailabilityMode);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const toggleDaily = () => setViewMode(viewMode === "daily" ? "box" : "daily");

  // Regional dexes available for the active generation
  const availableRegionalDexes = meta.regionalDexes.filter((rd) => {
    const genMeta = meta.generations.find((g) => g.id === activeGeneration);
    if (!genMeta) return false;
    return rd.games.some((g) => (genMeta.versions as string[]).includes(g));
  });

  if (tab === "routes") {
    return (
      <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-screen-2xl mx-auto overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-0 px-4 py-2">
          <GameSelector meta={meta} />
        </div>
      </div>
    );
  }

  // Tracker tab
  return (
    <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800">

      {/* ── Desktop: single row ───────────────────────────────────────── */}
      <div className="hidden md:flex max-w-screen-2xl mx-auto px-4 py-2 items-center gap-2 flex-wrap">
        <DexModeButtons
          dexMode={dexMode}
          setDexMode={setDexMode}
          availableRegionalDexes={availableRegionalDexes}
        />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <GameSelector meta={meta} />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <AvailabilityButtons availabilityMode={availabilityMode} setAvailabilityMode={setAvailabilityMode} />
        <HelpButton open={openPanel === "help"} onClick={() => togglePanel("help")} />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <SearchBar />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <ViewToggle />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <ToolButtons viewMode={viewMode} setViewMode={setViewMode} />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <button
          onClick={toggleDaily}
          title="Daily events checklist"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all flex-shrink-0 ${
            viewMode === "daily"
              ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50"
              : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700"
          }`}
        >
          <CalendarDays size={14} />
          Daily
        </button>
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <button
          onClick={() => setQuickMark(!quickMark)}
          aria-pressed={quickMark}
          title={quickMarkTitle}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all flex-shrink-0 ${
            quickMark
              ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50"
              : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700"
          }`}
        >
          <Zap size={14} />
          Quick mark
        </button>
        <button
          onClick={() => togglePanel("breakdown")}
          aria-expanded={openPanel === "breakdown"}
          title="Progress breakdown by game and Pokédex"
          className="ml-auto flex items-center gap-2 flex-shrink-0 px-2 py-1 rounded-md hover:bg-gray-800 transition-colors"
        >
          <span className="text-xs text-green-400 tabular-nums">{caught} / {total} caught</span>
          <span className="text-xs text-gray-500" aria-hidden="true">·</span>
          <span className="text-xs text-yellow-400 tabular-nums">{caught + pending} incl. pending</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${openPanel === "breakdown" ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* ── Mobile: filters, search + layout, then the tools ──────────── */}
      <div className="flex flex-col md:hidden divide-y divide-gray-800/60">

        {/* Row 1: the three filters, equal thirds. 16 px text, so iOS doesn't zoom in on focus */}
        <div className="px-2 py-1.5 grid grid-cols-3 gap-1.5">
          {availableRegionalDexes.length > 0 && (
            <MobileSelect
              value={dexMode}
              onChange={(v) => setDexMode(v as typeof dexMode)}
              label="Pokédex"
              options={[{ value: "national", label: "National" }, ...availableRegionalDexes.map((rd) => ({ value: rd.id, label: rd.name.replace(/ Pokédex$/, " dex") }))]}
            />
          )}

          <GameSelector meta={meta} compact />

          <MobileSelect
            value={availabilityMode}
            onChange={(v) => setAvailabilityMode(v as AvailabilityMode)}
            label="Availability filter"
            options={AVAILABILITY_OPTIONS.map((o) => ({ value: o.id, label: o.mobileLabel }))}
          />
        </div>

        {/* Row 2: search (as wide as it can be) + box / list / slots */}
        <div className="px-2 py-1.5 flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <SearchBar fullWidth />
          </div>
          <ViewToggle />
        </div>

        {/* Row 3: daily, quick mark, breakdown and help, then the tools that replace the
            Pokémon list with something else. More than fits a phone's width: the row scrolls sideways */}
        <div className="px-2 py-1 flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden" data-testid="tool-row">
          <MobileIconToggle active={viewMode === "daily"} onClick={toggleDaily} label="Daily events checklist" pressed={viewMode === "daily"}>
            <CalendarDays size={16} />
          </MobileIconToggle>
          <MobileIconToggle active={quickMark} onClick={() => setQuickMark(!quickMark)} label="Quick mark" title={quickMarkTitle} pressed={quickMark}>
            <Zap size={16} />
          </MobileIconToggle>
          <MobileIconToggle active={openPanel === "breakdown"} onClick={() => togglePanel("breakdown")} label="Progress breakdown" expanded={openPanel === "breakdown"}>
            <BarChart3 size={16} />
          </MobileIconToggle>
          <MobileIconToggle active={openPanel === "help"} onClick={() => togglePanel("help")} label="What do the availability modes mean?" expanded={openPanel === "help"}>
            <HelpCircle size={16} />
          </MobileIconToggle>
          <div className="w-px h-6 bg-gray-700 flex-shrink-0 mx-0.5" />
          <ToolButtons viewMode={viewMode} setViewMode={setViewMode} />
        </div>

      </div>

      {/* ── Expandable strip: progress breakdown / availability help ───── */}
      {openPanel && (
        <div className="border-t border-gray-800 bg-gray-900">
          <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-start gap-3 max-h-[50vh] overflow-y-auto">
            <div className="flex-1 min-w-0 max-w-3xl">
              {openPanel === "help" && <AvailabilityHelp />}
              {openPanel === "breakdown" && allPokemon && <ProgressBreakdown allPokemon={allPokemon} meta={meta} />}
            </div>
            <button
              onClick={() => setOpenPanel(null)}
              aria-label="Close"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

const TOOLS: { id: ViewMode; label: string; title: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "next",  label: "What's next", title: "What can I get next: locations ranked by how many uncaught Pokémon they have", Icon: Compass },
  { id: "items", label: "Items",       title: "Evolution items: what you need to evolve what you have caught, and where to get it",   Icon: Gem },
  { id: "progress", label: "Progress", title: "Progress over time: caught by date, milestones and this week's count",                 Icon: TrendingUp },
  { id: "hunts", label: "Shiny hunts", title: "Shiny hunt counter: count encounters, see the odds, mark it shiny when you find it",   Icon: Sparkles },
  { id: "saves", label: "Saves",       title: "Your game saves: import a save file, living dex, to-do list",                 Icon: Save },
  { id: "log",   label: "Changes",     title: "Change log: what each import and each mark changed, with undo",               Icon: History },
];

/**
 * What's next, Saves and Changes are tools of their own, not ways of laying out
 * the Pokémon list, so they sit apart from the box / list / slots toggle as
 * labelled buttons. Pressing the open one again goes back to the box view.
 */
function ToolButtons({ viewMode, setViewMode, stretch = false }: {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  stretch?: boolean;
}) {
  return (
    <>
      {TOOLS.map(({ id, label, title, Icon }) => (
        <button
          key={id}
          onClick={() => setViewMode(viewMode === id ? "box" : id)}
          aria-pressed={viewMode === id}
          title={title}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all flex-shrink-0 whitespace-nowrap ${stretch ? "flex-1" : ""} ${
            viewMode === id
              ? "bg-indigo-600 text-white border-indigo-500 shadow"
              : "bg-gray-800 text-gray-100 border-gray-600 hover:bg-gray-700 hover:border-gray-500"
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </>
  );
}

function HelpButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      aria-label="What do the availability modes mean?"
      title="What do All, Obtainable, Catchable and Needs attention mean?"
      className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${
        open ? "text-indigo-400 bg-indigo-600/20" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
      }`}
    >
      <HelpCircle size={16} />
    </button>
  );
}

// ── Desktop-only inline button groups ────────────────────────────────────────

function DexModeButtons({
  dexMode,
  setDexMode,
  availableRegionalDexes,
}: {
  dexMode: string;
  setDexMode: (m: string) => void;
  availableRegionalDexes: { id: string; name: string }[];
}) {
  if (availableRegionalDexes.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setDexMode("national")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          dexMode === "national"
            ? "bg-indigo-600 text-white"
            : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        }`}
      >
        National
      </button>
      {availableRegionalDexes.map((rd) => (
        <button
          key={rd.id}
          onClick={() => setDexMode(dexMode === rd.id ? "national" : rd.id)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            dexMode === rd.id
              ? "bg-indigo-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          }`}
        >
          {rd.name}
        </button>
      ))}
    </div>
  );
}

const AVAILABILITY_OPTIONS = [
  { id: "all",              label: "All",            mobileLabel: "All",        title: "Show all Pokémon regardless of game availability" },
  { id: "obtainable",       label: "Obtainable",     mobileLabel: "Obtainable", title: "Highlight Pokémon reachable in selected games" },
  { id: "catchable",        label: "Catchable",      mobileLabel: "Catchable",  title: "Only Pokémon with direct wild, gift, or static encounters" },
  { id: "now",              label: "Right now",      mobileLabel: "Right now",  title: "Catchable at this time of day and on this day of the week, by this device's clock" },
  { id: "needs-attention",  label: "Needs Attn",     mobileLabel: "Needs attn", title: "Caught but unevolved · Requires trade · Uncaught exclusives" },
] as const;

/** A phone filter: a native select with its own chevron, so the text gets the whole width. */
function MobileSelect({ value, onChange, label, options }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative min-w-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full min-h-[40px] appearance-none pl-2.5 pr-6 rounded-md text-base font-medium bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:border-indigo-500 truncate cursor-pointer"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

/** A 44 px square icon button for the phone toolbar. */
function MobileIconToggle({ active, onClick, label, title, pressed, expanded, children }: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
  pressed?: boolean;
  expanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-md border transition-all ${
        active
          ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50"
          : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function AvailabilityButtons({
  availabilityMode,
  setAvailabilityMode,
}: {
  availabilityMode: AvailabilityMode;
  setAvailabilityMode: (m: AvailabilityMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-0.5">
      {AVAILABILITY_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setAvailabilityMode(opt.id as AvailabilityMode)}
          title={opt.title}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            availabilityMode === opt.id
              ? opt.id === "all"
                ? "bg-gray-600 text-white shadow"
                : "bg-indigo-600 text-white shadow"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
