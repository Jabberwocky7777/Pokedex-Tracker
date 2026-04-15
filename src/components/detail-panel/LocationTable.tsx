import { useMemo } from "react";
import type { GameEncounters, EncounterDetail, EncounterMethod } from "../../types";

interface BestSpot {
  locationDisplayName: string;
  method: EncounterMethod;
  minLevel: number;
  maxLevel: number;
  chance: number;
}
import { GAME_LABELS, GAME_COLORS, ENCOUNTER_METHOD_LABELS, GEN3_GAME_ORDER, GEN4_GAME_ORDER } from "../../types";
import type { GameVersion } from "../../types";

interface NpcTradeRow {
  games: string[];
  note: string;
}

interface Props {
  encounters: GameEncounters[];
  evolvesFrom: number | null;
  evolvesFromName: string | null;
  evolvesFromDetails: string | null; // e.g. "Level 16"
  npcTrades: NpcTradeRow[];
  breedParentName: string | null;
  onRouteClick?: (slug: string) => void;
}

interface MergedLocation {
  locationAreaSlug: string;
  locationDisplayName: string;
  merged: MergedDetail[];
}

interface MergedEncounter {
  version: GameEncounters["version"];
  locations: MergedLocation[];
}

// Compute best spot from pre-merged details (highest combined %, tiebreak lowest level)
function computeBestSpot(enc: MergedEncounter): BestSpot | null {
  let best: BestSpot | null = null;
  let bestChance = -1;

  for (const loc of enc.locations) {
    for (const det of loc.merged) {
      if (det.isStatic) {
        if (!best) {
          best = { locationDisplayName: loc.locationDisplayName, method: det.method, minLevel: det.minLevel, maxLevel: det.maxLevel, chance: 0 };
        }
      } else if (det.totalChance > bestChance || (det.totalChance === bestChance && best && det.minLevel < best.minLevel)) {
        bestChance = det.totalChance;
        best = { locationDisplayName: loc.locationDisplayName, method: det.method, minLevel: det.minLevel, maxLevel: det.maxLevel, chance: det.totalChance };
      }
    }
  }
  return best;
}

interface MergedDetail {
  method: EncounterMethod;
  minLevel: number;
  maxLevel: number;
  totalChance: number;
  isStatic: boolean;
}

function mergeDetails(details: EncounterDetail[]): MergedDetail[] {
  const map = new Map<string, MergedDetail>();

  for (const d of details) {
    const key = `${d.method}`;
    const existing = map.get(key);
    if (existing) {
      existing.minLevel = Math.min(existing.minLevel, d.minLevel);
      existing.maxLevel = Math.max(existing.maxLevel, d.maxLevel);
      if (!d.isStatic) existing.totalChance += d.chance;
    } else {
      map.set(key, {
        method: d.method as EncounterMethod,
        minLevel: d.minLevel,
        maxLevel: d.maxLevel,
        totalChance: d.isStatic ? 0 : d.chance,
        isStatic: d.isStatic,
      });
    }
  }

  return Array.from(map.values());
}

const GAME_ORDER: GameVersion[] = [...GEN3_GAME_ORDER, ...GEN4_GAME_ORDER];

export default function LocationTable({
  encounters,
  evolvesFrom,
  evolvesFromName,
  evolvesFromDetails,
  npcTrades,
  breedParentName,
  onRouteClick,
}: Props) {
  const hasWildEncounters = encounters.length > 0;
  const hasNpcTrades = npcTrades.length > 0;
  const hasBreeding = !!breedParentName;

  // Pre-compute merged details for all locations — used by both the best-spot banner
  // and the encounter table rows, so we only call mergeDetails() once per location.
  // Must be called before any early returns to satisfy rules-of-hooks.
  const sortedWithMerged = useMemo<MergedEncounter[]>(
    () =>
      [...encounters]
        .sort((a, b) => GAME_ORDER.indexOf(a.version as GameVersion) - GAME_ORDER.indexOf(b.version as GameVersion))
        .map((enc) => ({
          version: enc.version,
          locations: enc.locations.map((loc) => ({
            locationAreaSlug: loc.locationAreaSlug,
            locationDisplayName: loc.locationDisplayName,
            merged: mergeDetails(loc.details),
          })),
        })),
    [encounters]
  );

  // Nothing at all
  if (!hasWildEncounters && !hasNpcTrades && !hasBreeding && evolvesFrom === null) {
    return (
      <div className="text-sm text-gray-500 italic px-1 py-2">
        No encounter data available.
      </div>
    );
  }

  // Only evolution (no wild encounters, no trades, no breeding)
  if (!hasWildEncounters && !hasNpcTrades && !hasBreeding && evolvesFrom !== null && evolvesFromName) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-teal-900/20 border border-teal-700/30">
          <span className="text-teal-400 text-base mt-0.5">↑</span>
          <div className="text-sm">
            <span className="text-teal-300 font-medium">Obtainable via evolution</span>
            <div className="text-gray-400 text-xs mt-0.5">
              Evolve {evolvesFromName}
              {evolvesFromDetails ? ` — ${evolvesFromDetails}` : ""}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Breeding note (baby Pokémon) ── */}
      {hasBreeding && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-pink-900/20 border border-pink-700/30">
          <span className="text-pink-300 text-base mt-0.5">🥚</span>
          <div className="text-sm">
            <span className="text-pink-300 font-medium">Obtainable via breeding</span>
            <div className="text-gray-400 text-xs mt-0.5">
              Breed {breedParentName} to hatch this Pokémon
            </div>
          </div>
        </div>
      )}

      {/* ── NPC in-game trades ── */}
      {hasNpcTrades && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">In-Game Trades</div>
          {npcTrades.map((trade, i) => {
            // Group games by their label+color
            const gameChips = trade.games.map((g) => ({
              label: GAME_LABELS[g as GameVersion] ?? g,
              color: GAME_COLORS[g as GameVersion] ?? "#6b7280",
            }));
            return (
              <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-900/20 border border-blue-700/30">
                <span className="text-blue-300 text-base mt-0.5">⇄</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {gameChips.map((chip) => (
                      <span
                        key={chip.label}
                        className="px-1.5 py-0.5 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: chip.color }}
                      >
                        {chip.label}
                      </span>
                    ))}
                    <span className="text-blue-300 text-xs font-medium">NPC Trade</span>
                  </div>
                  <div className="text-gray-300 text-xs leading-snug">{trade.note}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Evolution note ── */}
      {evolvesFrom !== null && evolvesFromName && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-teal-900/20 border border-teal-700/30">
          <span className="text-teal-400 mt-0.5">↑</span>
          <div className="text-xs">
            <span className="text-teal-300 font-medium">Also obtainable: </span>
            <span className="text-gray-300">Evolve {evolvesFromName}</span>
            {evolvesFromDetails ? <span className="text-gray-400"> — {evolvesFromDetails}</span> : ""}
          </div>
        </div>
      )}

      {/* ── Wild encounter tables ── */}
      {sortedWithMerged.map((enc) => {
        const gameLabel = GAME_LABELS[enc.version as GameVersion] ?? enc.version;
        const gameColor = GAME_COLORS[enc.version as GameVersion] ?? "#6b7280";
        const bestSpot = computeBestSpot(enc);

        return (
          <div key={enc.version}>
            <div
              className="flex items-center gap-2 mb-2 pb-1 border-b"
              style={{ borderColor: `${gameColor}40` }}
            >
              <span
                className="px-2 py-0.5 rounded text-xs font-bold text-white"
                style={{ backgroundColor: gameColor }}
              >
                {gameLabel}
              </span>
            </div>

            {bestSpot && (
              <div className="mb-2 px-2 py-1.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-1.5">
                <span className="text-yellow-400 text-sm mt-0.5 flex-shrink-0">★</span>
                <div className="text-xs">
                  <span className="text-yellow-300 font-medium">Best: </span>
                  <span className="text-gray-200">{bestSpot.locationDisplayName}</span>
                  <span className="text-gray-400"> — </span>
                  <span className="text-gray-300">
                    {ENCOUNTER_METHOD_LABELS[bestSpot.method as keyof typeof ENCOUNTER_METHOD_LABELS] ?? bestSpot.method}
                  </span>
                  {bestSpot.chance > 0 && (
                    <span className="text-gray-400">
                      , Lv {bestSpot.minLevel}–{bestSpot.maxLevel} ({bestSpot.chance}%)
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-lg overflow-hidden border border-gray-700/50">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-800/60">
                    <th className="text-left py-1.5 px-2 text-gray-400 font-medium">Location</th>
                    <th className="text-left py-1.5 px-2 text-gray-400 font-medium">Method</th>
                    <th className="text-right py-1.5 px-2 text-gray-400 font-medium">Levels</th>
                    <th className="text-right py-1.5 px-2 text-gray-400 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {enc.locations.map((loc, li) =>
                    loc.merged.map((det, di) => (
                      <tr
                        key={`${li}-${di}`}
                        className={`border-t border-gray-700/30 ${det.isStatic ? "bg-purple-900/10" : ""}`}
                      >
                        <td className="py-1.5 px-2 text-gray-200">
                          {det.isStatic && (
                            <span className="mr-1 text-purple-400" title="One-time encounter">!</span>
                          )}
                          {onRouteClick ? (
                            <button
                              onClick={() => onRouteClick(loc.locationAreaSlug)}
                              className="text-left hover:text-blue-400 hover:underline transition-colors"
                            >
                              {loc.locationDisplayName}
                            </button>
                          ) : (
                            loc.locationDisplayName
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-gray-400">
                          {ENCOUNTER_METHOD_LABELS[det.method as keyof typeof ENCOUNTER_METHOD_LABELS] ?? det.method}
                        </td>
                        <td className="py-1.5 px-2 text-gray-300 text-right font-mono">
                          {det.isStatic ? "—" : det.minLevel === det.maxLevel ? `${det.minLevel}` : `${det.minLevel}–${det.maxLevel}`}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {det.isStatic || det.totalChance === 0 ? (
                            <span className="text-purple-400 font-medium">1×</span>
                          ) : (
                            <span className={`font-medium ${
                              det.totalChance >= 20 ? "text-green-400" :
                              det.totalChance >= 10 ? "text-yellow-400" :
                              "text-red-400"
                            }`}>
                              {det.totalChance}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
