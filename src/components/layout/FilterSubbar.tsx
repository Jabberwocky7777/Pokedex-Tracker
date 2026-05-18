import { CalendarDays } from "lucide-react";
import GameSelector from "../controls/GameSelector";
import ViewToggle from "../controls/ViewToggle";
import SearchBar from "../controls/SearchBar";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { AvailabilityMode, MetaData } from "../../types";

interface Props {
  meta: MetaData;
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
export default function FilterSubbar({ meta, caught, total, pending = 0, tab }: Props) {
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
        <MobileDexModeButtons
          dexMode={dexMode}
          setDexMode={setDexMode}
          availableRegionalDexes={availableRegionalDexes}
        />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <GameSelector meta={meta} />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <AvailabilityButtons availabilityMode={availabilityMode} setAvailabilityMode={setAvailabilityMode} />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <SearchBar />
        <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
        <ViewToggle />
        {tab === "tracker" && (
          <>
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
          </>
        )}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-green-400 tabular-nums">{caught} / {total}</span>
          <span className="text-xs text-yellow-400 tabular-nums">({caught + pending}) / {total}</span>
        </div>
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

        </div>

        {/* Row 2: Search bar (full width) + view toggle + daily */}
        <div className="px-3 py-1.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <SearchBar fullWidth />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ViewToggle />
            {tab === "tracker" && (
              <button
                onClick={toggleDaily}
                title="Daily events checklist"
                className={`p-1.5 rounded-md border text-xs transition-all ${
                  viewMode === "daily"
                    ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50"
                    : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200"
                }`}
              >
                <CalendarDays size={15} />
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

// ── Desktop-only inline button groups (reused from old desktop row) ──────────

function MobileDexModeButtons({
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
