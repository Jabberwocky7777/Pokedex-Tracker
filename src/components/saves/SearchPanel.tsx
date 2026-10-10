import { useMemo, useState } from "react";
import type { Pokemon } from "../../types";
import { useSaveStore } from "../../store/useSaveStore";
import { NATURES } from "../../lib/iv-calc";
import { ivTotal } from "../../lib/save/best-copy";
import { slotLabel } from "../../lib/save/living-dex";
import {
  MON_SEARCH_HELP, MON_SEARCH_PLACEHOLDER, matchesMon, needsFullSave, parseMonSearch, type SearchEntry,
} from "../../lib/save/mon-search";
import { findFull } from "../../lib/save/summary";
import type { ProfileMons, SlimMon } from "../../lib/save/types";
import { monSprite } from "./saveDisplay";

interface Props {
  /** Every imported save, whatever the generation */
  profiles: ProfileMons[];
  pokemonMap: Map<number, Pokemon>;
  /** Open a result in its save's box browser */
  onPick: (profileId: string, mon: SlimMon) => void;
}

const MAX_RESULTS = 120;

/** Search every Pokémon in every imported save. */
export default function SearchPanel({ profiles, pokemonMap, onPick }: Props) {
  const fullSaves = useSaveStore((s) => s.fullSaves);
  const [query, setQuery] = useState("");

  const entries = useMemo<SearchEntry[]>(
    () =>
      profiles.flatMap((profile) =>
        profile.mons.map((mon) => ({
          profile,
          mon,
          full: findFull(fullSaves, profile.profile.id, mon),
          speciesName: pokemonMap.get(mon.species)?.displayName ?? `#${mon.species}`,
        })),
      ),
    [profiles, fullSaves, pokemonMap],
  );

  const terms = useMemo(() => parseMonSearch(query), [query]);
  const results = useMemo(() => (terms.length > 0 ? entries.filter((e) => matchesMon(e, terms)) : []), [entries, terms]);
  // Saves imported on another device only have the summary, so detail searches can't see into them
  const summaryOnly = profiles.filter((p) => !fullSaves[p.profile.id]);
  const blind = needsFullSave(terms) && summaryOnly.length > 0;

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={MON_SEARCH_PLACEHOLDER}
          title={MON_SEARCH_HELP}
          aria-label="Search your saves"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={{ fontSize: "16px" }}
          className="w-full pl-3 pr-9 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            ✕
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">{MON_SEARCH_HELP}</p>

      {blind && (
        <div role="note" className="px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-sm text-gray-300">
          {summaryOnly.map((p) => p.profile.label).join(", ")} {summaryOnly.length === 1 ? "was" : "were"} imported on another
          device, so only name, shiny, egg and level can be searched there.
        </div>
      )}

      {terms.length > 0 && (
        <div className="text-xs text-gray-400" role="status">
          {results.length === 0 ? "Nothing matches." : `${results.length} Pokémon${results.length > MAX_RESULTS ? ` — showing the first ${MAX_RESULTS}` : ""}`}
        </div>
      )}

      <ul className="flex flex-col gap-1">
        {results.slice(0, MAX_RESULTS).map(({ profile, mon, full, speciesName }) => (
          <li key={`${profile.profile.id}:${mon.box}:${mon.slot}`}>
            <button
              onClick={() => onPick(profile.profile.id, mon)}
              className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-left transition-colors"
            >
              <img src={monSprite(mon, pokemonMap.get(mon.species))} alt="" loading="lazy" className="w-9 h-9 object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-gray-100">
                  {mon.isEgg ? "Egg" : full?.isNicknamed && !full.nameUnsupported ? `${full.nickname} (${speciesName})` : speciesName}
                  {mon.shiny && !mon.isEgg && <span className="text-yellow-300"> ✦</span>}
                  {!mon.isEgg && <span className="text-gray-500"> · Lv. {mon.level}</span>}
                </span>
                <span className="block text-xs text-gray-500">
                  {profile.profile.label} · {slotLabel(profile.boxNames, mon.box, mon.slot)}
                  {full && !mon.isEgg && ` · ${NATURES[full.nature]?.name} · ${ivTotal(full)} IV total`}
                </span>
              </span>
              <span className="text-xs text-indigo-300 flex-shrink-0">Open →</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
