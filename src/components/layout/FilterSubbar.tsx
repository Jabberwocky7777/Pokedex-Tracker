import { useState } from "react";
import { CalendarDays, Zap, HelpCircle, BarChart3, ChevronDown, X } from "lucide-react";
import GameSelector from "../controls/GameSelector";
import ViewToggle from "../controls/ViewToggle";
import SearchBar from "../controls/SearchBar";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { AvailabilityMode, MetaData, Pokemon } from "../../types";
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
      <div className="sticky top-[calc(44px+env(safe-area-inset-top,0px))] md:top-[64px] z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-screen-2xl mx-auto overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-0 px-4 py-2">
          <GameSelector meta={meta} />
        </div>
      </div>
    );
  }

  // Tracker tab
  return (
    <div className="sticky top-[calc(44px+env(safe-area-inset-top,0px))] md:top-[64px] z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800">

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
          <span className="text-xs text-green-400 tabular-nums">{caught} / {total}</span>
          <span className="text-xs text-yellow-400 tabular-nums">({caught + pending}) / {total}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${openPanel === "breakdown" ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* ── Mobile: 2 rows ────────────────────────────────────────────── */}
      <div className="flex flex-col md:hidden divide-y divide-gray-800/60">

        {/* Row 1: [DexMode select]  [Game compact dropdown]  [Availability select]  [caught/total] */}
        <div className="px-3 py-1.5 flex items-center gap-2">
          {availableRegionalDexes.length > 0 && (
            <select
              value={dexMode}
              onChange={(e) => setDexMode(e.target.value as typeof dexMode)}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-sm font-medium bg-gray-800 text-gray-200 border border-gray-700 hover:border-gray-500 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              aria-label="Pokédex mode"
            >
              <option value="national">National</option>
              {availableRegionalDexes.map((rd) => (
                <option key={rd.id} value={rd.id}>{rd.name}</option>
              ))}
            </select>
          )}

          <GameSelector meta={meta} compact />

          <select
            value={availabilityMode}
            onChange={(e) => setAvailabilityMode(e.target.value as AvailabilityMode)}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-sm font-medium bg-gray-800 text-gray-200 border border-gray-700 hover:border-gray-500 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            aria-label="Availability filter"
          >
            <option value="all">All</option>
            <option value="obtainable">Obtainable</option>
            <option value="catchable">Catchable</option>
            <option value="needs-attention">Needs Attention</option>
          </select>
          <HelpButton open={openPanel === "help"} onClick={() => togglePanel("help")} />

        </div>

        {/* Row 2: Search bar (full width) + view toggle + daily */}
        <div className="px-3 py-1.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <SearchBar fullWidth />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ViewToggle />
            <button
              onClick={toggleDaily}
              title="Daily events checklist"
              aria-label="Daily events checklist"
              aria-pressed={viewMode === "daily"}
              className={`p-1.5 rounded-md border text-xs transition-all ${
                viewMode === "daily"
                  ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50"
                  : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200"
              }`}
            >
              <CalendarDays size={15} />
            </button>
            <button
              onClick={() => setQuickMark(!quickMark)}
              aria-pressed={quickMark}
              aria-label="Quick mark"
              title={quickMarkTitle}
              className={`p-1.5 rounded-md border text-xs transition-all ${
                quickMark
                  ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50"
                  : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200"
              }`}
            >
              <Zap size={15} />
            </button>
            <button
              onClick={() => togglePanel("breakdown")}
              aria-expanded={openPanel === "breakdown"}
              aria-label="Progress breakdown"
              title="Progress breakdown by game and Pokédex"
              className={`p-1.5 rounded-md border text-xs transition-all ${
                openPanel === "breakdown"
                  ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50"
                  : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200"
              }`}
            >
              <BarChart3 size={15} />
            </button>
          </div>
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
  { id: "all",              label: "All",            title: "Show all Pokémon regardless of game availability" },
  { id: "obtainable",       label: "Obtainable",     title: "Highlight Pokémon reachable in selected games" },
  { id: "catchable",        label: "Catchable",      title: "Only Pokémon with direct wild, gift, or static encounters" },
  { id: "needs-attention",  label: "Needs Attn",     title: "Caught but unevolved · Requires trade · Uncaught exclusives" },
] as const;

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
