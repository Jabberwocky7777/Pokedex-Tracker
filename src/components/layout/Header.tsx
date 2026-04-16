import GameSelector from "../controls/GameSelector";
import DexModeSelector from "../controls/DexModeSelector";
import ViewToggle from "../controls/ViewToggle";
import ProgressBar from "../controls/ProgressBar";
import DarkModeToggle from "../controls/DarkModeToggle";
import GenerationSelector from "../controls/GenerationSelector";
import SearchBar from "../controls/SearchBar";
import AvailabilityFilter from "../controls/AvailabilityFilter";
import SaveIndicator from "../controls/SaveIndicator";
import SyncIndicator from "../controls/SyncIndicator";
import BackupButton from "../controls/BackupButton";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { MetaData, AppTab } from "../../types";

interface Props {
  meta: MetaData;
  caught: number;
  total: number;
  percentage: number;
}

const TABS: { id: AppTab; label: string; icon: string }[] = [
  { id: "tracker",    label: "Tracker",           icon: "📋" },
  { id: "pokedex",    label: "Pokédex",            icon: "📖" },
  { id: "routes",     label: "Route Info",         icon: "🗺️" },
  { id: "catch-calc", label: "Catch Calculator",   icon: "🎣" },
  { id: "iv-checker", label: "IV Checker",         icon: "🔬" },
];

export default function Header({ meta, caught, total, percentage }: Props) {
  const { activeTab, setActiveTab } = useSettingsStore();

  return (
    <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800">
      {/* Tab bar — always visible, includes generation selector */}
      <div className="max-w-screen-2xl mx-auto px-4 pt-2 flex items-center gap-1 border-b border-gray-800/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-all -mb-px border border-transparent ${
              activeTab === tab.id
                ? "bg-gray-950 border-gray-700 border-b-gray-950 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/40"
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        {/* Generation selector + backup button — visible on all tabs */}
        <div className="ml-auto pb-1 flex items-center gap-2">
          <BackupButton />
          <GenerationSelector meta={meta} />
        </div>
      </div>

      {/* Tracker controls — only visible on tracker tab */}
      {activeTab === "tracker" && (
        <div className="max-w-screen-2xl mx-auto flex flex-col gap-2 px-4 py-3">
          {/* Top row: title + progress + controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {/* Poké Ball icon */}
              <div className="w-7 h-7 rounded-full bg-red-500 relative overflow-hidden border-2 border-gray-300 flex-shrink-0">
                <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border border-gray-300" />
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Pokédex Tracker
              </h1>
            </div>

            <ProgressBar caught={caught} total={total} percentage={percentage} />

            <div className="flex items-center gap-2 ml-auto">
              <SyncIndicator />
              <SaveIndicator />
              <ViewToggle />
              <DarkModeToggle />
            </div>
          </div>

          {/* Bottom row: dex mode + game selector + search + availability */}
          <div className="flex items-center gap-3 flex-wrap">
            <DexModeSelector meta={meta} />
            <div className="w-px h-5 bg-gray-700 hidden sm:block" />
            <GameSelector meta={meta} />
            <div className="w-px h-5 bg-gray-700 hidden sm:block" />
            <AvailabilityFilter />
            <div className="w-px h-5 bg-gray-700 hidden sm:block" />
            <SearchBar />
          </div>
        </div>
      )}

      {/* Route info controls — game selector to filter routes */}
      {activeTab === "routes" && (
        <div className="max-w-screen-2xl mx-auto flex items-center gap-4 px-4 py-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-red-500 relative overflow-hidden border-2 border-gray-300 flex-shrink-0">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border border-gray-300" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Route Info</h1>
          </div>
          <GameSelector meta={meta} />
          <div className="ml-auto">
            <DarkModeToggle />
          </div>
        </div>
      )}

      {/* Minimal header for calculator/checker/pokedex tabs */}
      {activeTab !== "tracker" && activeTab !== "routes" && (
        <div className="max-w-screen-2xl mx-auto flex items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-red-500 relative overflow-hidden border-2 border-gray-300 flex-shrink-0">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border border-gray-300" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              {TABS.find((t) => t.id === activeTab)?.label ?? "Pokédex"}
            </h1>
          </div>
          <div className="ml-auto">
            <DarkModeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
