import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ListChecks, X } from "lucide-react";
import type { GameVersion, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useDexStore } from "../../store/useDexStore";
import { useTripStore, type Trip } from "../../store/useTripStore";
import { liveEntries } from "../../lib/entries";
import { buildNextLocations, type NextLocation } from "../../lib/what-next";
import { tripSections } from "../../lib/trip";
import { METHOD_ORDER, METHOD_LABELS } from "../../hooks/useRouteIndex";
import { toggleWithUndo } from "../../lib/dex-actions";
import { addJournalEntry, localDate } from "../../lib/journal";
import { getGenSprite } from "../../lib/pokemon-display";
import { areaDisplayName } from "../../lib/area-names";

interface Props {
  /** The generation's Pokémon */
  pokemon: Pokemon[];
  generation: number;
  /** "Routes ticked here", offered when some are */
  ticked: { slugs: string[]; games: string[]; setup: boolean } | null;
}

const dateTime = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The sheet's rows, in the printed order: routes as printed, methods in table order, Pokémon by number */
function rowsOf(trip: Pick<Trip, "slugs" | "games" | "grouped" | "setup">, pokemon: Pokemon[], caught: ReadonlySet<number>) {
  const all = buildNextLocations(pokemon, trip.games, caught, trip.setup ?? true, undefined, { keepComplete: true });
  const bySlug = new Map(all.map((l) => [l.slug, l]));
  const picked = trip.slugs.map((s) => bySlug.get(s)).filter((l): l is NextLocation => !!l);
  const sections = trip.grouped ? tripSections(picked) : [{ id: "all", title: "", locations: picked }];
  return sections.flatMap((section) => section.locations.flatMap((loc) =>
    [...loc.byMethod]
      .sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method))
      .flatMap((m) => m.targets.map((t) => ({ key: `${section.id}-${loc.slug}-${m.method}-${t.pokemon.id}`, section: section.title, loc, method: m.method, pokemon: t.pokemon })))));
}

/**
 * Quick check-off after a trip: a printed sheet (or the routes ticked here) as
 * a list to tap through on the phone, in the order of the paper. Each tap marks
 * the Pokémon caught (with Undo); at the end, a journal entry can sum it up.
 */
export default function TripCheckOff({ pokemon, generation, ticked }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(ref, open, close);
  const tripEntries = useTripStore((s) => s.entries);
  const trips = useMemo(
    () => liveEntries(tripEntries).map(([id, t]) => ({ ...t, id })).filter((t) => t.generation === generation).sort((a, b) => b.printedAt - a.printedAt),
    [tripEntries, generation],
  );
  const [choice, setChoice] = useState<string>("");
  const caughtIds = useDexStore((s) => s.caughtByGen[generation]);
  const caught = useMemo(() => new Set(caughtIds ?? []), [caughtIds]);
  // What was caught when the list was opened, so the journal can say what this trip added
  const [before, setBefore] = useState<ReadonlySet<number>>(new Set());
  const [journaled, setJournaled] = useState(false);

  const trip = useMemo(() => {
    const source = choice === "ticked" ? ticked : trips.find((t) => t.id === choice) ?? trips[0] ?? ticked;
    return source ? { grouped: false, ...source } : null;
  }, [choice, trips, ticked]);
  // Rows are worked out from the marks at opening, so ticking one doesn't reorder the list
  const rows = useMemo(() => (trip && open ? rowsOf(trip, pokemon, before) : []), [trip, open, pokemon, before]);

  const nameOf = (id: number) => pokemon.find((p) => p.id === id)?.displayName ?? `#${id}`;
  const newlyCaught = [...caught].filter((id) => !before.has(id) && rows.some((r) => r.pokemon.id === id));
  const routes = trip ? [...new Set(rows.map((r) => areaDisplayName(r.loc.displayName)))] : [];

  const start = () => {
    setBefore(new Set(caught));
    setJournaled(false);
    setOpen(true);
  };
  const journal = () => {
    if (!trip || newlyCaught.length === 0) return;
    addJournalEntry({
      date: localDate(Date.now()),
      game: trip.games[0] as GameVersion,
      text: `Trip to ${routes.slice(0, 6).join(", ")}${routes.length > 6 ? " and more" : ""}: caught ${newlyCaught.map(nameOf).join(", ")}.`,
    });
    setJournaled(true);
  };

  if (trips.length === 0 && !ticked) return null;
  return (
    <>
      <button
        onClick={start}
        className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium"
        title="Tap through a printed sheet and mark what you caught"
      >
        <ListChecks size={15} aria-hidden="true" /> Check off a trip
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={close} aria-hidden="true" />
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="Check off a trip"
            tabIndex={-1}
            className="fixed z-50 inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[32rem] max-h-[90vh] flex flex-col bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            data-testid="trip-check-off"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-800">
              <h2 className="text-base font-semibold text-gray-100">Check off a trip</h2>
              <button onClick={close} aria-label="Close" className="p-2.5 -mr-2 rounded-full text-gray-400 hover:text-gray-100 hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="px-4 py-2 border-b border-gray-800">
              <select
                value={choice || (trips[0]?.id ?? "ticked")}
                onChange={(e) => setChoice(e.target.value)}
                aria-label="Which trip"
                className="w-full min-h-[44px] rounded-md bg-gray-800 border border-gray-700 text-gray-100 px-2"
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    Printed {dateTime(t.printedAt)} · {t.slugs.length} route{t.slugs.length === 1 ? "" : "s"} · {t.games.map((g) => GAME_LABELS[g as GameVersion] ?? g).join(", ")}
                  </option>
                ))}
                {ticked && <option value="ticked">The {ticked.slugs.length} route{ticked.slugs.length === 1 ? "" : "s"} ticked here</option>}
              </select>
            </div>
            <ul className="flex-1 overflow-y-auto px-2 py-1">
              {rows.map((r, i) => {
                const on = caught.has(r.pokemon.id);
                const head = i === 0 || rows[i - 1].loc.slug !== r.loc.slug || rows[i - 1].section !== r.section;
                return (
                  <li key={r.key}>
                    {r.section && (i === 0 || rows[i - 1].section !== r.section) && (
                      <p className="px-2 pt-3 text-xs font-semibold uppercase tracking-wide text-indigo-300">{r.section}</p>
                    )}
                    {head && <p className="px-2 pt-2 text-xs font-semibold text-gray-400">{areaDisplayName(r.loc.displayName)}</p>}
                    <button
                      onClick={() => toggleWithUndo("caught", r.pokemon.id, generation, r.pokemon.displayName)}
                      aria-pressed={on}
                      className={`w-full min-h-[48px] flex items-center gap-3 px-2 rounded-lg text-left ${on ? "bg-emerald-500/10" : "hover:bg-gray-800"}`}
                    >
                      <span className={`w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 ${on ? "bg-emerald-600 border-emerald-500 text-white" : "border-gray-600"}`}>
                        {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                      </span>
                      <img src={getGenSprite(r.pokemon, generation)} alt="" loading="lazy" className="w-8 h-8 object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />
                      <span className="min-w-0">
                        <span className={`block text-sm ${on ? "text-emerald-300" : "text-gray-100 font-medium"}`}>{r.pokemon.displayName}</span>
                        <span className="block text-xs text-gray-500">{METHOD_LABELS[r.method] ?? r.method}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {rows.length === 0 && <li className="px-2 py-6 text-sm text-gray-400 text-center">Nothing on this trip.</li>}
            </ul>
            <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-2">
              <span className="text-xs text-gray-400 flex-1">
                {newlyCaught.length === 0 ? "Tap what you caught." : `${newlyCaught.length} caught on this trip.`}
              </span>
              <button
                onClick={journal}
                disabled={newlyCaught.length === 0 || journaled}
                className="px-3 py-2 min-h-[44px] rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm text-white font-medium"
              >
                {journaled ? "Added to journal" : "Add a journal entry"}
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
