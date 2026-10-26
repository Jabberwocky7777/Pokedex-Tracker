import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { CalendarDays, Zap, HelpCircle, BarChart3, ChevronDown, X, Compass, Gem, TrendingUp, History, LayoutGrid } from "lucide-react";
import GameSelector from "../controls/GameSelector";
import ViewToggle from "../controls/ViewToggle";
import SearchBar from "../controls/SearchBar";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { AvailabilityMode, MetaData, Pokemon, ViewMode } from "../../types";
import ProgressBreakdown from "../tracker/ProgressBreakdown";
import AvailabilityHelp from "../tracker/AvailabilityHelp";
import SegmentedControl from "../shared/SegmentedControl";

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

      {/* ── Desktop: filters on the first row, what to look at on the second ── */}
      <div className="hidden md:flex flex-col max-w-screen-2xl mx-auto px-4 py-2 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBar />
          <ViewToggle />
          <button
            onClick={() => setQuickMark(!quickMark)}
            aria-pressed={quickMark}
            title={quickMarkTitle}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all flex-shrink-0 ${
              quickMark
                ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/50"
                : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700"
            }`}
          >
            <Zap size={14} />
            Quick mark
          </button>
          <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
          <ViewsSegmented viewMode={viewMode} setViewMode={setViewMode} />
          <button
            onClick={() => togglePanel("breakdown")}
            aria-expanded={openPanel === "breakdown"}
            title="Progress breakdown by game and Pokédex"
            className="ml-auto flex items-center gap-2 flex-shrink-0 px-2 py-1 rounded-md hover:bg-gray-800 transition-colors"
          >
            <span className="text-xs text-emerald-400 tabular-nums">{caught} / {total} caught</span>
            <span className="text-xs text-gray-500" aria-hidden="true">·</span>
            <span className="text-xs text-yellow-400 tabular-nums">{caught + pending} incl. pending</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${openPanel === "breakdown" ? "rotate-180" : ""}`} />
          </button>
        </div>
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

        {/* Row 3: one Views button for the tools that replace the Pokémon list, then quick mark, breakdown and help */}
        <div className="px-2 py-1 flex items-center gap-1.5" data-testid="tool-row">
          <ViewsMenuButton viewMode={viewMode} setViewMode={setViewMode} />
          <MobileIconToggle active={quickMark} onClick={() => setQuickMark(!quickMark)} label="Quick mark" title={quickMarkTitle} pressed={quickMark}>
            <Zap size={16} />
          </MobileIconToggle>
          <MobileIconToggle active={openPanel === "breakdown"} onClick={() => togglePanel("breakdown")} label="Progress breakdown" expanded={openPanel === "breakdown"}>
            <BarChart3 size={16} />
          </MobileIconToggle>
          <MobileIconToggle active={openPanel === "help"} onClick={() => togglePanel("help")} label="What do the availability modes mean?" expanded={openPanel === "help"}>
            <HelpCircle size={16} />
          </MobileIconToggle>
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

/** The views that replace the Pokémon list with a tool of their own. "Pokémon" is the list itself. */
const VIEWS: { id: ViewMode | "list"; label: string; title: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "list",  label: "Pokémon",     title: "The Pokémon list, in the box, list or slots layout",                                          Icon: LayoutGrid },
  { id: "next",  label: "What's next", title: "What can I get next: locations ranked by how many uncaught Pokémon they have",               Icon: Compass },
  { id: "daily", label: "Daily",       title: "Daily and weekly events checklist",                                                           Icon: CalendarDays },
  { id: "items", label: "Items",       title: "Evolution items: what you need to evolve what you have caught, and where to get it",         Icon: Gem },
  { id: "progress", label: "Progress", title: "Progress over time: caught by date, milestones and this week's count",                       Icon: TrendingUp },
  { id: "log",   label: "Changes",     title: "Change log: what each import and each mark changed, with undo",                               Icon: History },
];

const LIST_LAYOUTS: ViewMode[] = ["box", "list", "slots"];
const currentView = (viewMode: ViewMode) => (LIST_LAYOUTS.includes(viewMode) ? "list" : viewMode);

/** Picking "Pokémon" goes back to the box layout; picking a tool opens it. */
function pickView(id: ViewMode | "list", viewMode: ViewMode, setViewMode: (mode: ViewMode) => void) {
  if (id === "list") {
    if (!LIST_LAYOUTS.includes(viewMode)) setViewMode("box");
  } else {
    setViewMode(id);
  }
}

/** Desktop: every view in one segmented row, the open one highlighted. */
function ViewsSegmented({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) {
  const current = currentView(viewMode);
  return (
    <div role="radiogroup" aria-label="View" className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-800/60 flex-wrap">
      {VIEWS.map(({ id, label, title, Icon }) => {
        const active = current === id;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={active}
            aria-pressed={active}
            onClick={() => pickView(id, viewMode, setViewMode)}
            title={title}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              active ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-gray-100 hover:bg-gray-700/60"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Phone: one button naming the open view; it opens a sheet with all of them. */
function ViewsMenuButton({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(sheetRef, open, close);
  const current = VIEWS.find((v) => v.id === currentView(viewMode)) ?? VIEWS[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex-1 min-w-0 h-11 flex items-center gap-2 px-3 rounded-md border bg-gray-800 border-gray-700 text-gray-100 text-sm font-medium"
      >
        <current.Icon size={16} className="text-indigo-300 flex-shrink-0" />
        <span className="text-gray-400 flex-shrink-0">View:</span>
        <span className="truncate">{current.label}</span>
        <ChevronDown size={16} className="ml-auto text-gray-400 flex-shrink-0" />
      </button>
      {/* In a portal: the bar's backdrop-blur would otherwise be what "fixed" is relative to */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={close} aria-hidden="true" />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Views"
            tabIndex={-1}
            className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">View</span>
              <button onClick={close} aria-label="Close" className="p-2.5 -mr-2 rounded-full text-gray-400 hover:text-gray-100 hover:bg-gray-800">
                <X size={18} />
              </button>
            </div>
            <ul className="px-2">
              {VIEWS.map(({ id, label, title, Icon }) => {
                const active = current.id === id;
                return (
                  <li key={id}>
                    <button
                      onClick={() => { pickView(id, viewMode, setViewMode); close(); }}
                      aria-current={active ? "true" : undefined}
                      aria-pressed={active}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 min-h-[48px] rounded-xl text-left transition-colors ${
                        active ? "bg-indigo-500/15" : "hover:bg-gray-800"
                      }`}
                    >
                      <Icon size={20} className={`mt-0.5 flex-shrink-0 ${active ? "text-indigo-300" : "text-gray-400"}`} />
                      <span className="min-w-0">
                        <span className={`block text-sm font-medium ${active ? "text-indigo-200" : "text-gray-100"}`}>{label}</span>
                        <span className="block text-xs text-gray-400 mt-0.5">{title}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>,
        document.body,
      )}
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
    <SegmentedControl
      ariaLabel="Pokédex"
      value={dexMode}
      onChange={setDexMode}
      options={[{ value: "national", label: "National" }, ...availableRegionalDexes.map((rd) => ({ value: rd.id, label: rd.name }))]}
    />
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
    <SegmentedControl
      ariaLabel="Availability"
      size="sm"
      value={availabilityMode}
      onChange={setAvailabilityMode}
      options={AVAILABILITY_OPTIONS.map((opt) => ({ value: opt.id as AvailabilityMode, label: opt.label, title: opt.title }))}
    />
  );
}
