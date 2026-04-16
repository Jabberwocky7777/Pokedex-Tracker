import { useState } from "react";
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
import SideDrawer from "./SideDrawer";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { MetaData, AppTab } from "../../types";

interface Props {
  meta: MetaData;
  caught: number;
  total: number;
  percentage: number;
  onLogout?: () => void;
}

const TABS: { id: AppTab; label: string; icon: string }[] = [
  { id: "tracker",    label: "Tracker",           icon: "📋" },
  { id: "pokedex",    label: "Pokédex",            icon: "📖" },
  { id: "routes",     label: "Route Info",         icon: "🗺️" },
  { id: "catch-calc", label: "Catch Calculator",   icon: "🎣" },
  { id: "iv-checker", label: "IV Checker",         icon: "🔬" },
];

/** Reusable Poké Ball icon used in desktop sub-headers. */
function PokeBall() {
  return (
    <div className="w-7 h-7 rounded-full bg-red-500 relative overflow-hidden border-2 border-gray-300 flex-shrink-0">
      <div className="absolute inset-x-0 top-1/2 h-px bg-gray-300" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border border-gray-300" />
    </div>
  );
}

export default function Header({ meta, caught, total, percentage, onLogout }: Props) {
  const { activeTab, setActiveTab } = useSettingsStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentTabLabel = TABS.find((t) => t.id === activeTab)?.label ?? "Pokédex Tracker";

  return (
    <>
      {/* ── Left-side nav drawer (mobile only) ─────────────────────────────── */}
      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tabs={TABS}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={onLogout}
      />

      <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800">

        {/* ── Mobile top bar (hidden on md+) ───────────────────────────────── */}
        <div className="flex md:hidden items-center gap-2 px-3 py-2 border-b border-gray-800/60 min-h-[52px]">
          {/* Hamburger — 44 px tap target */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-1
              rounded-lg text-gray-300 hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Current tab name */}
          <span className="flex-1 text-sm font-semibold text-white truncate min-w-0">
            {currentTabLabel}
          </span>

          {/* Right controls: backup, generation selector, dark mode */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <BackupButton />
            <GenerationSelector meta={meta} />
            <DarkModeToggle />
          </div>
        </div>

        {/* ── Desktop tab bar (hidden below md) ───────────────────────────── */}
        <div className="hidden md:flex max-w-screen-2xl mx-auto px-4 pt-2 items-center gap-1 border-b border-gray-800/60">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg
                transition-all -mb-px border border-transparent ${
                activeTab === tab.id
                  ? "bg-gray-950 border-gray-700 border-b-gray-950 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/40"
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
          {/* Generation selector + backup + logout — top-right on all desktop tabs */}
          <div className="ml-auto pb-1 flex items-center gap-2">
            <BackupButton />
            <GenerationSelector meta={meta} />
            <button
              onClick={() => onLogout?.()}
              title="Sign out"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Sign out
            </button>
          </div>
        </div>

        {/* ── Tracker controls ─────────────────────────────────────────────── */}
        {activeTab === "tracker" && (
          <div className="max-w-screen-2xl mx-auto flex flex-col gap-2 px-4 py-3">

            {/* Title + progress bar + right-side icons */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Title hidden on mobile — the mobile top bar shows the tab name */}
              <div className="hidden md:flex items-center gap-2">
                <PokeBall />
                <h1 className="text-lg font-bold text-white tracking-tight">Pokédex Tracker</h1>
              </div>

              <ProgressBar caught={caught} total={total} percentage={percentage} />

              <div className="flex items-center gap-2 ml-auto">
                <SyncIndicator />
                <SaveIndicator />
                <ViewToggle />
                {/* Dark mode toggle is in the mobile top bar; show here on desktop only */}
                <span className="hidden md:contents">
                  <DarkModeToggle />
                </span>
              </div>
            </div>

            {/* Filter controls ─────────────────────────────────────────────────
                Mobile: single horizontally-scrollable row (swipe to reveal more).
                Desktop: wrapping flex row with separators.
                The -mx-4 px-4 trick extends the scroll zone to the screen edges on
                mobile so controls aren't clipped by the header padding.           */}
            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
              <div className="flex items-center gap-3 flex-nowrap md:flex-wrap">
                <DexModeSelector meta={meta} />
                <div className="w-px h-5 bg-gray-700 flex-shrink-0 hidden md:block" />
                <GameSelector meta={meta} />
                <div className="w-px h-5 bg-gray-700 flex-shrink-0 hidden md:block" />
                <AvailabilityFilter />
                <div className="w-px h-5 bg-gray-700 flex-shrink-0 hidden md:block" />
                <div className="flex-shrink-0">
                  <SearchBar />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Route info controls ──────────────────────────────────────────── */}
        {activeTab === "routes" && (
          <div className="max-w-screen-2xl mx-auto flex items-center gap-4 px-4 py-3 flex-wrap">
            <div className="hidden md:flex items-center gap-2">
              <PokeBall />
              <h1 className="text-lg font-bold text-white tracking-tight">Route Info</h1>
            </div>
            {/* Game selector — scrollable on mobile via the outer overflow-x-auto */}
            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
              <div className="flex-shrink-0">
                <GameSelector meta={meta} />
              </div>
            </div>
            <div className="ml-auto hidden md:block">
              <DarkModeToggle />
            </div>
          </div>
        )}

        {/* ── Minimal sub-header for Pokédex / Catch Calc / IV Checker ────── */}
        {activeTab !== "tracker" && activeTab !== "routes" && (
          <div className="max-w-screen-2xl mx-auto hidden md:flex items-center gap-4 px-4 py-3">
            <div className="flex items-center gap-2">
              <PokeBall />
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
    </>
  );
}
