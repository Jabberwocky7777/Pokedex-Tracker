import { useState, useEffect, useMemo } from "react";
import type { Pokemon } from "../../types";
import { GEN3_VERSION_GROUPS, GEN4_VERSION_GROUPS, fetchLearnsets, type Gen4VersionGroup, type VersionGroup } from "../../lib/move-fetch";
import { fetchAttackdexDetail } from "../../lib/attackdex-fetch";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import { generationMaxId } from "../../lib/generation";
import VersionGroupTabs from "./VersionGroupTabs";

interface HmEntry {
  label: string;
  name: string;
  slug: string;
}

const GEN3_HMS: HmEntry[] = [
  { label: "HM01", name: "Cut",        slug: "cut"        },
  { label: "HM02", name: "Fly",        slug: "fly"        },
  { label: "HM03", name: "Surf",       slug: "surf"       },
  { label: "HM04", name: "Strength",   slug: "strength"   },
  { label: "HM05", name: "Flash",      slug: "flash"      },
  { label: "HM06", name: "Rock Smash", slug: "rock-smash" },
  { label: "HM07", name: "Waterfall",  slug: "waterfall"  },
  { label: "HM08", name: "Dive",       slug: "dive"       },
];

const GEN4_HMS_DPPT: HmEntry[] = [
  { label: "HM01", name: "Cut",        slug: "cut"        },
  { label: "HM02", name: "Fly",        slug: "fly"        },
  { label: "HM03", name: "Surf",       slug: "surf"       },
  { label: "HM04", name: "Strength",   slug: "strength"   },
  { label: "HM05", name: "Defog",      slug: "defog"      },
  { label: "HM06", name: "Rock Smash", slug: "rock-smash" },
  { label: "HM07", name: "Waterfall",  slug: "waterfall"  },
  { label: "HM08", name: "Rock Climb", slug: "rock-climb" },
];

const GEN4_HMS_HGSS: HmEntry[] = [
  { label: "HM01", name: "Cut",        slug: "cut"        },
  { label: "HM02", name: "Fly",        slug: "fly"        },
  { label: "HM03", name: "Surf",       slug: "surf"       },
  { label: "HM04", name: "Strength",   slug: "strength"   },
  { label: "HM05", name: "Whirlpool",  slug: "whirlpool"  },
  { label: "HM06", name: "Rock Smash", slug: "rock-smash" },
  { label: "HM07", name: "Waterfall",  slug: "waterfall"  },
  { label: "HM08", name: "Rock Climb", slug: "rock-climb" },
];

interface Props {
  allPokemon: Pokemon[];
  activeGeneration: number;
  onClose?: () => void;
  onSelectPokemon: (id: number) => void;
}

export default function HmPlannerPanel({ allPokemon, activeGeneration, onClose, onSelectPokemon }: Props) {
  const [hmVg, setHmVg] = useState<Gen4VersionGroup>("diamond-pearl");
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [resultIds, setResultIds] = useState<number[] | null>(null);

  const hmList = useMemo((): HmEntry[] => {
    if (activeGeneration !== 4) return GEN3_HMS;
    return hmVg === "heartgold-soulsilver" ? GEN4_HMS_HGSS : GEN4_HMS_DPPT;
  }, [activeGeneration, hmVg]);

  // Drop selections that no longer exist after a version group switch (defog ↔ whirlpool)
  useEffect(() => {
    const validSlugs = new Set(hmList.map((h) => h.slug));
    setSelectedSlugs((prev) => { // eslint-disable-line react-hooks/set-state-in-effect -- drop selections that no longer exist after version group switch
      const next = new Set([...prev].filter((s) => validSlugs.has(s)));
      return next.size === prev.size ? prev : next;
    });
  }, [hmList]);

  const genMax = generationMaxId(activeGeneration);

  useEffect(() => {
    const slugs = [...selectedSlugs];
    if (slugs.length === 0) {
      setResultIds(null); // eslint-disable-line react-hooks/set-state-in-effect -- clear results when no HMs are selected
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Gen IV: the game picked above. Gen III has no picker, so any of its games counts.
    const versionGroups: VersionGroup[] = activeGeneration === 4 ? [hmVg] : GEN3_VERSION_GROUPS.map((g) => g.id);

    Promise.all(slugs.map((s) => fetchAttackdexDetail(s)))
      .then(async (details) => {
        if (cancelled) return;

        const idSets = details.map((d) => new Set(d.learnedBy.filter((id) => id <= genMax)));

        const [first, ...rest] = idSets;
        const candidates = [...first].filter((id) => rest.every((s) => s.has(id)));

        // That list covers every supported game and every way of learning a move.
        // Keep only Pokémon that learn each one as an HM in these games.
        const learnsets = await fetchLearnsets(candidates);
        const verified = candidates.filter((_, i) =>
          slugs.every((slug) =>
            versionGroups.some((vg) => learnsets[i][vg].some((m) => m.move === slug && m.method === "machine"))));

        if (!cancelled) setResultIds(verified.sort((a, b) => a - b));
      })
      .catch(() => { if (!cancelled) setResultIds([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [selectedSlugs, genMax, activeGeneration, hmVg]);

  const resultPokemon = useMemo(() => {
    if (!resultIds) return null;
    return resultIds.flatMap((id) => {
      const p = allPokemon.find((p) => p.id === id);
      return p ? [p] : [];
    });
  }, [resultIds, allPokemon]);

  function toggleHm(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header — only shown when rendered standalone (with a back action) */}
      {onClose && (
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white flex items-center justify-center transition-all flex-shrink-0"
            title="Back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h3 className="text-lg font-bold text-white">HM Planner</h3>
            <p className="text-xs text-gray-400">Select HMs to find Pokémon that can learn all of them</p>
          </div>
        </div>
      )}

      {/* Version group selector — Gen 4 only */}
      {activeGeneration === 4 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Version</span>
          <VersionGroupTabs
            activeVersionGroups={GEN4_VERSION_GROUPS}
            versionGroup={hmVg}
            setVersionGroup={(vg) => setHmVg(vg as Gen4VersionGroup)}
          />
        </div>
      )}

      {/* HM toggle chips */}
      <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">HMs</span>
          {selectedSlugs.size > 0 && (
            <button
              onClick={() => setSelectedSlugs(new Set())}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {hmList.map((hm) => {
            const selected = selectedSlugs.has(hm.slug);
            return (
              <button
                key={hm.slug}
                onClick={() => toggleHm(hm.slug)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  selected
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white"
                }`}
              >
                <span className="text-xs opacity-60 mr-1.5">{hm.label}</span>
                {hm.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3 min-h-48">
        {selectedSlugs.size === 0 && (
          <div className="flex items-center justify-center py-12 text-gray-600">
            <p className="text-sm">Select HMs above to find compatible Pokémon</p>
          </div>
        )}

        {selectedSlugs.size > 0 && loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {selectedSlugs.size > 0 && !loading && resultPokemon !== null && (
          <>
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              {resultPokemon.length === 0
                ? "No Pokémon can learn all selected HMs"
                : `${resultPokemon.length} Pokémon`}
            </span>
            {resultPokemon.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
                {resultPokemon.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onSelectPokemon(p.id); onClose?.(); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all group"
                    title={p.displayName}
                  >
                    <img
                      src={getGenSprite(p, activeGeneration)}
                      alt={p.displayName}
                      className="w-12 h-12 object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <span className="text-xs text-gray-500 font-mono">#{formatDexNumber(p.id)}</span>
                    <span className="text-xs text-gray-300 group-hover:text-white text-center leading-tight">{p.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
