import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePopoverAnchor } from "../../hooks/usePopoverAnchor";
import AvailabilityHelp from "../tracker/AvailabilityHelp";
import type { AvailabilityMode, MetaData } from "../../types";
import CellLegend from "../box-view/CellLegend";

/** What each availability mode shows; keep in step with computeAvailability / filterPokemon and AvailabilityHelp. */
const SHOW_OPTIONS: { id: AvailabilityMode; label: string; description: string }[] = [
  { id: "all", label: "All", description: "Every Pokémon of the generation" },
  { id: "obtainable", label: "Obtainable", description: "Catch, evolve, breed or trade for in your games" },
  { id: "catchable", label: "Catchable", description: "Wild, gift or static encounters only" },
  { id: "now", label: "Right now", description: "Catchable at this time of day and weekday" },
  { id: "needs-attention", label: "Needs attention", description: "Unevolved catches, trades, exclusives" },
];

function useDexes(meta: MetaData) {
  const generation = useSettingsStore((s) => s.activeGeneration);
  const genMeta = meta.generations.find((g) => g.id === generation);
  const regional = meta.regionalDexes.filter((rd) =>
    rd.games.some((g) => ((genMeta?.versions ?? []) as string[]).includes(g)),
  );
  return [
    { id: "national", label: "National" },
    ...regional.map((rd) => ({ id: rd.id, label: rd.name.replace(/ Pokédex$/, "") })),
  ];
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      className={`mt-0.5 w-3.5 h-3.5 rounded-full flex-shrink-0 border-[1.5px] ${
        on ? "border-[4px] border-indigo-400" : "border-gray-500"
      }`}
      aria-hidden="true"
    />
  );
}

/**
 * The tracker's two filters as plain choices with a line of explanation each: which Pokédex,
 * and which Pokémon to show. In the tracker's sidebar on a wide screen, in ScopeButton's
 * panel otherwise.
 */
export function ScopeOptions({ meta, dense = false }: { meta: MetaData; dense?: boolean }) {
  const dexMode = useSettingsStore((s) => s.dexMode);
  const setDexMode = useSettingsStore((s) => s.setDexMode);
  const mode = useSettingsStore((s) => s.availabilityMode);
  const setMode = useSettingsStore((s) => s.setAvailabilityMode);
  const dexes = useDexes(meta);
  const [help, setHelp] = useState(false);
  const row = `w-full flex items-start gap-2.5 px-2.5 rounded-md text-left text-sm hover:bg-gray-800/60 ${
    dense ? "py-1.5" : "py-2"
  } pointer-coarse:min-h-11`;

  return (
    <div className="flex flex-col gap-4">
      {dexes.length > 1 && (
        <div role="radiogroup" aria-label="Pokédex">
          <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Pokédex</p>
          {dexes.map((d) => (
            <button
              key={d.id}
              role="radio"
              aria-checked={dexMode === d.id}
              onClick={() => setDexMode(d.id)}
              className={`${row} ${dexMode === d.id ? "text-white" : "text-gray-300"}`}
            >
              <Radio on={dexMode === d.id} />
              {d.label}
            </button>
          ))}
        </div>
      )}
      <div role="radiogroup" aria-label="Show">
        <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Show</p>
        {SHOW_OPTIONS.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={mode === o.id}
            onClick={() => setMode(o.id)}
            className={`${row} ${mode === o.id ? "text-white" : "text-gray-300"}`}
          >
            <Radio on={mode === o.id} />
            <span className="min-w-0">
              {o.label}
              <span className="block text-xs text-gray-500">{o.description}</span>
            </span>
          </button>
        ))}
        <button
          onClick={() => setHelp(!help)}
          aria-expanded={help}
          className="mt-1 px-2.5 py-1 text-xs text-indigo-300 hover:text-indigo-200"
        >
          {help ? "Hide the details" : "How these work"}
        </button>
        {help && (
          <div className="mt-2 px-2.5 text-xs flex flex-col gap-3">
            <CellLegend />
            <AvailabilityHelp />
          </div>
        )}
      </div>
    </div>
  );
}

/** "Johto · Obtainable" — the tracker's filters in one button, opening ScopeOptions (narrow windows). */
export function ScopeButton({ meta }: { meta: MetaData }) {
  const dexMode = useSettingsStore((s) => s.dexMode);
  const mode = useSettingsStore((s) => s.availabilityMode);
  const dexes = useDexes(meta);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { ref: anchorRef, position: anchorPosition, measure: measureAnchor } = usePopoverAnchor();
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(panelRef, open, close);
  const asSheet = useMediaQuery("(max-width: 767.98px), (max-height: 500px)");

  const dex = dexes.find((d) => d.id === dexMode)?.label ?? "National";
  const show = SHOW_OPTIONS.find((o) => o.id === mode)?.label ?? "All";

  return (
    <>
      <button
        ref={anchorRef}
        onClick={() => {
          measureAnchor();
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Filters: ${dex} Pokédex, ${show}`}
        data-testid="tracker-scope"
        className="flex items-center gap-1.5 h-9 pointer-coarse:h-11 px-3 min-w-0 rounded-lg border border-gray-700 hover:border-gray-500 bg-gray-900 text-sm text-gray-100"
      >
        <span className="truncate">
          {dex} <span className="text-gray-500">·</span> {show}
        </span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <>
            <div className={`fixed inset-0 z-50 ${asSheet ? "bg-black/50" : ""}`} onClick={close} aria-hidden="true" />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal={asSheet ? true : undefined}
              aria-label="Filters"
              tabIndex={-1}
              className={
                asSheet
                  ? "fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto px-2"
                  : "fixed z-50 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-2 max-h-[75vh] overflow-y-auto"
              }
              style={
                asSheet
                  ? {
                      paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
                      paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
                      paddingRight: "max(0.5rem, env(safe-area-inset-right))",
                    }
                  : anchorPosition
              }
            >
              {asSheet && (
                <div className="flex items-center justify-between px-2 pt-3 pb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Filters</span>
                  <button
                    onClick={close}
                    aria-label="Close"
                    className="p-2.5 -mr-2 rounded-full text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              <ScopeOptions meta={meta} dense={!asSheet} />
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
