import { useMemo } from "react";
import type { GameVersion, MetaData, Pokemon } from "../../types";
import { GAME_LABELS, GAME_COLORS } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import { computeAvailability } from "../../hooks/usePokemonFilter";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

interface Row {
  label: string;
  caught: number;
  total: number;
  color?: string;
}

function Bar({ label, caught, total, color }: Row) {
  const pct = total > 0 ? Math.round((caught / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 flex-shrink-0 text-gray-300 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden min-w-[4rem]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color ?? "#22c55e" }} />
      </div>
      <span className="w-24 flex-shrink-0 text-right tabular-nums text-gray-300">
        {caught} / {total} <span className="text-gray-500">({pct}%)</span>
      </span>
    </div>
  );
}

/** Expanded view of the progress counter: per game, per dex, and what's still obtainable. */
export default function ProgressBreakdown({ allPokemon, meta }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const activeGames = useSettingsStore((s) => s.activeGames);
  const dexMode = useSettingsStore((s) => s.dexMode);
  const caughtByGen = useDexStore((s) => s.caughtByGen);

  const data = useMemo(() => {
    const genMeta = meta.generations.find((g) => g.id === activeGeneration);
    if (!genMeta) return null;
    const [start, end] = genMeta.pokemonRange;
    const inGen = allPokemon.filter((p) => p.id >= start && p.id <= end);
    const caught = new Set(caughtByGen[activeGeneration] ?? []);
    const countCaught = (ids: Iterable<number>) => {
      let n = 0;
      for (const id of ids) if (caught.has(id)) n++;
      return n;
    };

    // Per game: how much of what that game can give you (catch, NPC trade, evolve, breed) is caught
    const games: GameVersion[] = activeGames.length > 0 ? activeGames : genMeta.versions;
    const perGame: Row[] = games.map((game) => {
      const { obtainable } = computeAvailability(inGen, [game]);
      return {
        label: GAME_LABELS[game],
        caught: countCaught(obtainable),
        total: obtainable.size,
        color: GAME_COLORS[game],
      };
    });

    // The dex being viewed: the active regional dex, or the National dex
    const regional = meta.regionalDexes.find((rd) => rd.id === dexMode);
    const dexIds = regional
      ? inGen.filter((p) => p.regionalDexEntries.some((e) => e.dexId === regional.id)).map((p) => p.id)
      : inGen.map((p) => p.id);
    const dex: Row = {
      label: regional ? regional.name : "National Pokédex",
      caught: countCaught(dexIds),
      total: dexIds.length,
    };

    // Across the whole selection: obtainable but not caught yet
    const { obtainable } = computeAvailability(inGen, games);
    const stillObtainable = obtainable.size - countCaught(obtainable);

    return { perGame, dex, stillObtainable, selectionLabel: activeGames.length > 0 ? "the selected games" : `all ${genMeta.name} games` };
  }, [allPokemon, meta, activeGeneration, activeGames, dexMode, caughtByGen]);

  if (!data) return null;

  return (
    <div className="flex flex-col gap-3 text-gray-200">
      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
          By game — caught / obtainable in that game
        </div>
        {data.perGame.map((row) => <Bar key={row.label} {...row} />)}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">By Pokédex</div>
        <Bar {...data.dex} />
      </div>
      <p className="text-xs text-gray-300">
        <span className="text-base font-bold text-indigo-300 tabular-nums">{data.stillObtainable}</span>{" "}
        obtainable in {data.selectionLabel} but not caught yet.
      </p>
    </div>
  );
}
