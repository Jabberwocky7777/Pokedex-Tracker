import { useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, X, Zap } from "lucide-react";
import ViewToggle from "../controls/ViewToggle";
import SearchBar from "../controls/SearchBar";
import { ScopeButton } from "./TrackerScope";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { MetaData, Pokemon } from "../../types";
import ProgressBreakdown from "../tracker/ProgressBreakdown";

interface Props {
  meta: MetaData;
  /** Needed for the progress breakdown */
  allPokemon: Pokemon[];
  caught: number;
  total: number;
  pending?: number;
  /** The Pokémon list is showing (not Progress or Changes): search and the layouts apply */
  onList: boolean;
  /** Pokédex and Show are in the sidebar; otherwise they are the scope button here */
  scopeInSidebar: boolean;
  /** On a phone: the views button (the tracker's sections), shown in this toolbar */
  viewMenu: ReactNode;
}

/**
 * The tracker's toolbar: search, the list's layout, Quick mark, the Pokédex / Show filters when
 * the sidebar isn't showing them, and the count (which opens the per-game breakdown). The games
 * are in the header; the views are the tracker's sections.
 */
export default function FilterSubbar({
  meta,
  allPokemon,
  caught,
  total,
  pending = 0,
  onList,
  scopeInSidebar,
  viewMenu,
}: Props) {
  const quickMark = useSettingsStore((s) => s.quickMark);
  const setQuickMark = useSettingsStore((s) => s.setQuickMark);
  const [breakdown, setBreakdown] = useState(false);
  const quickMarkTitle = quickMark
    ? "Quick mark is on: a single tap or click toggles caught"
    : "Quick mark is off: tap opens details, double-click toggles caught";
  const share = total > 0 ? caught / total : 0;
  const pendingShare = total > 0 ? pending / total : 0;

  return (
    <div className="flex-shrink-0 border-b border-gray-800" data-testid="tracker-toolbar">
      <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2.5">
        {onList && (
          <div className="flex-1 roomy:max-w-md min-w-0">
            <SearchBar fullWidth />
          </div>
        )}
        {/* A phone: the second row is the view, the filters and the layout */}
        <div className="order-last sm:order-none basis-full sm:basis-auto flex items-center gap-2 min-w-0">
          <span className="roomy:hidden">{viewMenu}</span>
          {!scopeInSidebar && (
            <div className="flex-1 sm:flex-none min-w-0 flex">
              <ScopeButton meta={meta} />
            </div>
          )}
          {onList && <ViewToggle />}
        </div>
        {onList && (
          <button
            onClick={() => setQuickMark(!quickMark)}
            aria-pressed={quickMark}
            aria-label="Quick mark"
            title={quickMarkTitle}
            className={`flex items-center justify-center gap-1.5 h-9 min-w-9 px-2 pointer-coarse:h-11 pointer-coarse:min-w-11 rounded-lg border text-sm transition-colors flex-shrink-0 ${
              quickMark
                ? "border-indigo-500/60 text-indigo-200 bg-indigo-500/10"
                : "border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500"
            }`}
          >
            <Zap size={15} aria-hidden="true" />
            <span className="hidden xl:inline">Quick mark</span>
          </button>
        )}
        <button
          onClick={() => setBreakdown(!breakdown)}
          aria-expanded={breakdown}
          aria-label={`${caught} of ${total} caught, ${pending} pending — breakdown by game and Pokédex`}
          title="Progress breakdown by game and Pokédex"
          className="roomy:ml-auto flex items-center gap-2.5 h-9 pointer-coarse:h-11 px-2 rounded-lg hover:bg-gray-900 transition-colors flex-shrink-0"
        >
          <BarChart3 size={15} className="text-gray-400 roomy:hidden" aria-hidden="true" />
          <span className="hidden roomy:flex w-28 h-1.5 rounded-full bg-gray-800 overflow-hidden" aria-hidden="true">
            <span className="bg-emerald-500" style={{ width: `${share * 100}%` }} />
            <span className="bg-amber-500/70" style={{ width: `${pendingShare * 100}%` }} />
          </span>
          {/* On a phone the header has the count; here it is just the way to the breakdown */}
          <span className="hidden roomy:inline text-sm tabular-nums text-gray-100">
            {caught}
            <span className="text-gray-500"> / {total}</span>
          </span>
          {pending > 0 && (
            <span className="hidden roomy:inline text-xs text-gray-400 tabular-nums">{pending} pending</span>
          )}
          <ChevronDown
            size={14}
            className={`hidden roomy:block text-gray-400 transition-transform ${breakdown ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {breakdown && (
        <div className="border-t border-gray-800">
          <div className="px-4 py-3 flex items-start gap-3 max-h-[50vh] overflow-y-auto">
            <div className="flex-1 min-w-0 max-w-3xl">
              <ProgressBreakdown allPokemon={allPokemon} meta={meta} />
            </div>
            <button
              onClick={() => setBreakdown(false)}
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
