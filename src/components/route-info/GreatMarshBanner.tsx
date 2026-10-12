import { useState, useMemo } from "react";
import type { Pokemon, GameVersion } from "../../types";
import { GAME_LABELS, GAME_COLORS } from "../../types";
import { getGenSprite, formatDexNumber } from "../../lib/pokemon-display";
import TypeBadge from "../shared/TypeBadge";
import { PokemonLink } from "../shared/links";

interface DailyEntry {
  pokemon: Pokemon;
  games: GameVersion[];
  chance: number;
  inSinnohDex: boolean;
}

interface Props {
  allPokemon: Pokemon[];
  activeGeneration: number;
}

const MARSH_GAME_VERSIONS: GameVersion[] = ["diamond", "pearl", "platinum"];

export default function GreatMarshBanner({ allPokemon, activeGeneration }: Props) {

  const [showPostDex, setShowPostDex] = useState(true);
  const [open, setOpen] = useState(true);

  // The daily pool: safari encounters at the "great-marsh" location
  const dailyPool = useMemo<DailyEntry[]>(() => {
    const entries = new Map<number, DailyEntry>();

    for (const p of allPokemon) {
      const games: GameVersion[] = [];
      let maxChance = 0;

      for (const enc of p.encounters) {
        const isMarshGame = MARSH_GAME_VERSIONS.includes(enc.version);
        if (!isMarshGame) continue;
        for (const loc of enc.locations) {
          if (loc.locationAreaSlug !== "great-marsh") continue;
          const safariDetails = loc.details.filter((d) => d.method === "safari");
          if (safariDetails.length === 0) continue;
          if (!games.includes(enc.version)) games.push(enc.version);
          const sum = safariDetails.reduce((a, b) => a + b.chance, 0);
          if (sum > maxChance) maxChance = sum;
        }
      }

      if (games.length === 0) continue;

      const inSinnohDex = p.regionalDexEntries?.some((e) => e.dexId.includes("sinnoh")) ?? false;
      entries.set(p.id, { pokemon: p, games, chance: maxChance, inSinnohDex });
    }

    // Sort: Sinnoh Dex first (pre-National), then National Dex only; within each group, by dex number
    return Array.from(entries.values()).sort((a, b) => {
      if (a.inSinnohDex !== b.inSinnohDex) return a.inSinnohDex ? -1 : 1;
      return a.pokemon.id - b.pokemon.id;
    });
  }, [allPokemon]);

  const displayed = showPostDex ? dailyPool : dailyPool.filter((e) => e.inSinnohDex);

  const preDexCount = dailyPool.filter((e) => e.inSinnohDex).length;
  const postDexCount = dailyPool.length - preDexCount;

  return (
    <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-950/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔭</span>
          <div>
            <span className="text-sm font-semibold text-emerald-300">Daily Pokémon</span>
            <span className="text-xs text-gray-500 ml-2">(binoculars rotation)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{displayed.length} species</span>
          <span className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Info note */}
          <p className="text-xs text-gray-500 leading-relaxed">
            Six Pokémon from this pool appear daily in the marsh (viewable through the binoculars upstairs).
            The pool rotates by the DS clock. All areas share the same daily pool.
          </p>

          {/* Pre/Post National Dex toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Show:</span>
            <button
              onClick={() => setShowPostDex(false)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${!showPostDex ? "bg-indigo-700 border-indigo-500 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}
            >
              Pre-National Dex ({preDexCount})
            </button>
            <button
              onClick={() => setShowPostDex(true)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${showPostDex ? "bg-indigo-700 border-indigo-500 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}
            >
              All ({dailyPool.length})
            </button>
            {postDexCount > 0 && showPostDex && (
              <span className="text-xs text-gray-600">+{postDexCount} need National Dex to register</span>
            )}
          </div>

          {/* Pokémon table */}
          <div className="rounded-lg overflow-hidden border border-gray-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/60 text-xs text-gray-400">
                  <th className="text-left py-2 pl-3 pr-1 w-8" />
                  <th className="text-left py-2 px-2">Pokémon</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Type</th>
                  <th className="text-left py-2 px-2">Games</th>
                  <th className="text-right py-2 pl-2 pr-3">Rate</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((entry, i) => {
                  const sprite = getGenSprite(entry.pokemon, activeGeneration);
                  const rateColor = entry.chance >= 10 ? "text-yellow-400" : "text-red-400";
                  return (
                    <tr
                      key={entry.pokemon.id}
                      className={`border-t border-gray-700/30 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                    >
                      <td className="py-1.5 pl-3 pr-1">
                        {sprite && (
                          <img src={sprite} alt={entry.pokemon.displayName} className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <PokemonLink id={entry.pokemon.id} className="font-medium text-gray-100">{entry.pokemon.displayName}</PokemonLink>
                          <span className="text-xs text-gray-600 font-mono">#{formatDexNumber(entry.pokemon.id)}</span>
                          {!entry.inSinnohDex && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-amber-900/40 border border-amber-700/50 text-amber-400 whitespace-nowrap">
                              Nat. Dex
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 hidden sm:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {entry.pokemon.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex gap-1 flex-wrap">
                          {MARSH_GAME_VERSIONS.filter((g) => entry.games.includes(g)).map((g) => (
                            <span
                              key={g}
                              className="px-1 py-0.5 rounded text-[10px] font-bold text-white"
                              style={{ backgroundColor: GAME_COLORS[g] ?? "#6b7280" }}
                            >
                              {GAME_LABELS[g]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-1.5 pl-2 pr-3 text-right">
                        <span className={`text-xs font-medium ${rateColor}`}>{entry.chance}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
