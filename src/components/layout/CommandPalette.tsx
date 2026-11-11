import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ClipboardList, LayoutGrid, Map as MapIcon, Search, Zap } from "lucide-react";
import type { Pokemon, PlanSection } from "../../types";
import { TAB_DEFS } from "./tabs";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { encounterAreas, normalizePlace } from "../../lib/location-links";
import { areaDisplayName } from "../../lib/area-names";
import { openMove, openPlan, openPokedex, openRoute, openTab, showInTracker } from "../../lib/navigate";
import { formatDexNumber } from "../../lib/pokemon-display";

interface Props {
  allPokemon: Pokemon[];
  onClose: () => void;
}

type Kind = "pokemon" | "route" | "move" | "tab" | "plan";

interface Result {
  kind: Kind;
  key: string;
  label: string;
  detail: string;
  /** What is matched against the query */
  haystack: string;
  open: () => void;
  /** Pokémon only: open it in the Pokédex instead of the tracker */
  alt?: () => void;
}

const PLAN_LABELS: Record<PlanSection, string> = {
  today: "Today",
  where: "Where to go",
  level: "Level up",
  items: "Items to get",
  working: "Working on",
  notes: "Notes",
  journal: "Journal",
  hunts: "Shiny hunts",
};

const ICONS: Record<Kind, typeof Search> = {
  pokemon: LayoutGrid,
  route: MapIcon,
  move: Zap,
  tab: BookOpen,
  plan: ClipboardList,
};

const MAX_RESULTS = 12;

/**
 * F6: Ctrl/Cmd+K from anywhere — one search across Pokémon, routes, moves, tabs
 * and Plan's sections. Enter opens the highlighted result (a Pokémon in the
 * tracker; Shift+Enter in the Pokédex). A lazy chunk, so it costs nothing until
 * first opened; moves load (moves.json) when it opens.
 */
export default function CommandPalette({ allPokemon, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, true, onClose);
  const [moves, setMoves] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([import("../../lib/move-data"), import("../../lib/move-names")]).then(
      async ([{ loadMovesFile }, { moveDisplayName }]) => {
        const file = await loadMovesFile().catch(() => null);
        if (!cancelled && file) setMoves(file.moves.map((m) => ({ slug: m.slug, name: moveDisplayName(m.slug) })));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const everything = useMemo<Result[]>(() => {
    const go = (fn: () => void) => () => {
      fn();
      onClose();
    };
    return [
      ...TAB_DEFS.map((t) => ({
        kind: "tab" as const,
        key: `tab:${t.id}`,
        label: t.label,
        detail: "Tab",
        haystack: t.label.toLowerCase(),
        open: go(() => openTab(t.id)),
      })),
      ...(Object.keys(PLAN_LABELS) as PlanSection[]).map((s) => ({
        kind: "plan" as const,
        key: `plan:${s}`,
        label: PLAN_LABELS[s],
        detail: "Plan",
        haystack: PLAN_LABELS[s].toLowerCase(),
        open: go(() => openPlan(s)),
      })),
      ...allPokemon.map((p) => ({
        kind: "pokemon" as const,
        key: `pokemon:${p.id}`,
        label: p.displayName,
        detail: `#${formatDexNumber(p.id)}`,
        haystack: `${p.displayName.toLowerCase()} ${p.id} #${formatDexNumber(p.id)}`,
        open: go(() => showInTracker(p.id)),
        alt: go(() => openPokedex(p.id)),
      })),
      ...encounterAreas(allPokemon).map((a) => ({
        kind: "route" as const,
        key: `route:${a.slug}`,
        label: areaDisplayName(a.name),
        detail: "Route",
        haystack: normalizePlace(a.name),
        open: go(() => openRoute(a.slug)),
      })),
      ...moves.map((m) => ({
        kind: "move" as const,
        key: `move:${m.slug}`,
        label: m.name,
        detail: "Move",
        haystack: m.name.toLowerCase(),
        open: go(() => openMove(m.slug)),
      })),
    ];
  }, [allPokemon, moves, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const place = normalizePlace(q);
    const scored: [number, Result][] = [];
    for (const r of everything) {
      const hay = r.haystack;
      const at = r.kind === "route" ? hay.indexOf(place) : hay.indexOf(q);
      if (at < 0) continue;
      // Starts-with first, then word starts, then anywhere; tabs and Pokémon before the rest
      const score =
        (at === 0 ? 0 : hay[at - 1] === " " ? 1 : 2) * 10 +
        (r.kind === "tab" || r.kind === "plan" ? 0 : r.kind === "pokemon" ? 1 : 2);
      scored.push([score, r]);
    }
    return scored
      .sort((a, b) => a[0] - b[0] || a[1].label.length - b[1].label.length)
      .slice(0, MAX_RESULTS)
      .map(([, r]) => r);
  }, [everything, query]);

  const active = Math.min(index, Math.max(0, results.length - 1));

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      const r = results[active];
      (e.shiftKey && r.alt ? r.alt : r.open)();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-4 pt-[12vh]" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search everything"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-3 border-b border-gray-800">
          <Search size={16} className="text-gray-500 flex-shrink-0" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Pokémon, route, move or tab…"
            aria-label="Search everything"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="command-results"
            aria-activedescendant={results[active] ? `cmd-${results[active].key}` : undefined}
            className="flex-1 py-3 bg-transparent text-gray-100 placeholder-gray-500 text-sm focus:outline-none"
          />
          <kbd className="text-[11px] text-gray-500 border border-gray-700 rounded px-1">Esc</kbd>
        </div>
        <ul id="command-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {results.map((r, i) => {
            const Icon = ICONS[r.kind];
            return (
              <li
                key={r.key}
                id={`cmd-${r.key}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setIndex(i)}
                onClick={r.open}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${
                  i === active ? "bg-indigo-600/30 text-white" : "text-gray-200"
                }`}
              >
                <Icon size={15} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate">{r.label}</span>
                <span className="text-xs text-gray-500">{r.detail}</span>
              </li>
            );
          })}
          {query.trim() && results.length === 0 && <li className="px-3 py-3 text-sm text-gray-400">Nothing found.</li>}
        </ul>
        <p className="px-3 py-2 border-t border-gray-800 text-xs text-gray-500">
          ↑ ↓ to choose · Enter opens (a Pokémon in the tracker) · Shift+Enter opens a Pokémon in the Pokédex
        </p>
      </div>
    </div>
  );
}
