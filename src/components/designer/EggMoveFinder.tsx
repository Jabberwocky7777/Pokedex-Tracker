import { useEffect, useMemo, useState } from "react";
import type { Pokemon } from "../../types";
import { useDexStore } from "../../store/useDexStore";
import { baseStage, findEggMoveChains } from "../../lib/breeding";
import { fetchLearnsets, type PokemonLearnset, type VersionGroup } from "../../lib/move-fetch";
import { moveDisplayName } from "../../lib/move-names";
import { generationMaxId } from "../../lib/generation";
import { MoveLink, PokemonLink } from "../shared/links";

interface Props {
  pokemon: Pokemon;
  allPokemon: Pokemon[];
  activeGeneration: number;
  versionGroup: VersionGroup;
}

const SHOWN = 8;
const HOW: Record<string, string> = { "level-up": "learns it at Lv.", machine: "learns it by TM/HM", tutor: "learns it from a tutor", egg: "gets it as an egg move" };

/**
 * Egg-move chain finder: for an egg move of this Pokémon, which Pokémon can be
 * the father — starting from one that learns the move by itself, through any
 * that have to be bred in between. Chains that start with a caught Pokémon come first.
 */
export default function EggMoveFinder({ pokemon, allPokemon, activeGeneration, versionGroup }: Props) {
  const caughtIds = useDexStore((s) => s.caughtByGen[activeGeneration]);
  const [learnsets, setLearnsets] = useState<Map<number, PokemonLearnset> | null>(null);
  const [move, setMove] = useState("");

  const pool = useMemo(() => allPokemon.filter((p) => p.id <= generationMaxId(activeGeneration)), [allPokemon, activeGeneration]);

  useEffect(() => {
    let cancelled = false;
    void fetchLearnsets(pool.map((p) => p.id)).then((sets) => {
      if (!cancelled) setLearnsets(new Map(pool.map((p, i) => [p.id, sets[i]])));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pool]);

  // Egg moves are listed on the lowest stage of the line
  const eggMoves = useMemo(() => {
    if (!learnsets) return [];
    const base = baseStage(pokemon, new Map(pool.map((p) => [p.id, p])));
    const rows = learnsets.get(base.id)?.[versionGroup] ?? [];
    return [...new Set(rows.filter((m) => m.method === "egg").map((m) => m.move))].sort((a, b) => moveDisplayName(a).localeCompare(moveDisplayName(b)));
  }, [learnsets, pokemon, pool, versionGroup]);

  const selected = eggMoves.includes(move) ? move : "";
  const chains = useMemo(() => {
    if (!learnsets || !selected) return [];
    return findEggMoveChains(pokemon, selected, pool, new Set(caughtIds ?? []), (id) => learnsets.get(id)?.[versionGroup] ?? []);
  }, [learnsets, selected, pokemon, pool, caughtIds, versionGroup]);

  if (!learnsets) return <p className="text-xs text-gray-500">Loading learnsets…</p>;
  if (eggMoves.length === 0) return <p className="text-xs text-gray-500">{pokemon.displayName} has no egg moves in this game.</p>;

  return (
    <div className="flex flex-col gap-3" data-testid="egg-move-finder">
      <label className="flex items-center gap-2 text-xs text-gray-400">
        Egg move
        <select
          value={selected}
          onChange={(e) => setMove(e.target.value)}
          className="flex-1 min-w-0 px-2 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">— Choose one —</option>
          {eggMoves.map((slug) => <option key={slug} value={slug}>{moveDisplayName(slug)}</option>)}
        </select>
      </label>

      {selected && (
        <>
          <p className="text-xs text-gray-400">
            The father passes <MoveLink slug={selected}>{moveDisplayName(selected)}</MoveLink> down. Each line reads left to right:
            breed the first with a female of the next, and so on, ending with a female {pokemon.displayName} (or one of its line).
            ✓ marks what you have caught.
          </p>
          {chains.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No father found within three steps in this game.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {chains.slice(0, SHOWN).map((chain) => (
                <li
                  key={chain.links.map((l) => l.pokemon.id).join(">")}
                  className={`px-3 py-2 rounded-lg border text-sm ${chain.startsCaught ? "bg-emerald-900/20 border-emerald-700/40" : "bg-gray-800/50 border-gray-700"}`}
                >
                  {chain.links.map((link, i) => (
                    <span key={link.pokemon.id}>
                      {i > 0 && <span className="text-gray-500"> → </span>}
                      <PokemonLink id={link.pokemon.id} className="text-gray-100">{link.pokemon.displayName}</PokemonLink>
                      {link.caught && <span className="text-emerald-400"> ✓</span>}
                      <span className="text-xs text-gray-500"> ({HOW[link.how]}{link.how === "level-up" ? ` ${link.level}` : ""})</span>
                    </span>
                  ))}
                  <span className="text-gray-500"> → </span>
                  <span className="text-gray-300">{pokemon.displayName}</span>
                </li>
              ))}
            </ul>
          )}
          {chains.length > SHOWN && <p className="text-xs text-gray-500">{chains.length - SHOWN} more ways not shown.</p>}
        </>
      )}
    </div>
  );
}
