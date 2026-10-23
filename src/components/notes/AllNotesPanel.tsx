import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Pokemon } from "../../types";
import { useNotesStore } from "../../store/useNotesStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { findNotes, notesIn, type NoteSort } from "../../lib/notes";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import { showInTracker } from "../../lib/navigate";
import SegmentedControl from "../shared/SegmentedControl";
import { AllNotesPrint } from "./NotesPrint";

interface Props {
  allPokemon: Pokemon[];
}

const date = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Every per-Pokémon note of the active generation, searchable; one opens that Pokémon in the tracker. */
export default function AllNotesPanel({ allPokemon }: Props) {
  const generation = useSettingsStore((s) => s.activeGeneration);
  const entries = useNotesStore((s) => s.entries);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<NoteSort>("recent");
  const pokemonById = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);
  const all = useMemo(() => notesIn(entries, generation), [entries, generation]);
  const rows = useMemo(
    () => findNotes(all, query, sort, (id) => pokemonById.get(id)?.displayName ?? ""),
    [all, query, sort, pokemonById],
  );

  return (
    <section className="flex flex-col gap-4" aria-label="All notes">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes and names…"
            aria-label="Search notes"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <SegmentedControl
          ariaLabel="Sort notes"
          size="sm"
          value={sort}
          onChange={setSort}
          options={[{ value: "recent", label: "Recently edited" }, { value: "dex", label: "Dex number" }]}
        />
        <AllNotesPrint rows={rows} pokemonById={pokemonById} generation={generation} query={query} />
      </div>

      <p className="text-xs text-gray-500">
        {all.length === 0
          ? `No notes in Generation ${generation} yet. Write one in a Pokémon's detail panel in the tracker, or in the Pokédex.`
          : `${rows.length} of ${all.length} note${all.length === 1 ? "" : "s"} · Generation ${generation}`}
      </p>

      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const pokemon = pokemonById.get(row.pokemonId);
          if (!pokemon) return null;
          return (
            <li key={row.pokemonId}>
              <button
                onClick={() => showInTracker(row.pokemonId, generation)}
                title="Show in the tracker"
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-indigo-500 text-left transition-colors"
              >
                <img src={getGenSprite(pokemon, generation)} alt="" width={40} height={40} loading="lazy" className="w-10 h-10 object-contain pixelated flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-100">
                      {pokemon.displayName} <span className="font-normal text-gray-500">#{formatDexNumber(pokemon.id)}</span>
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{date.format(row.at)}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-300 whitespace-pre-line line-clamp-2">{row.text}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
