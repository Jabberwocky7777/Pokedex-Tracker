import { useMemo } from "react";
import { GEN3_SPLIT_VERSION_GROUPS, getMachines } from "./pokedexHelpers";
import { MoveTable, type MoveRow } from "./MoveTable";
import { SectionHeading } from "./SectionHeading";
import type { MoveDetail, PokemonLearnset, VersionGroup, Gen3VersionGroup } from "../../lib/move-fetch";

interface Props {
  learnset: PokemonLearnset | null;
  moveDetails: Map<string, MoveDetail>;
  loading: boolean;
  error: string | null;
  versionGroup: VersionGroup;
}

export function MovesSection({ learnset, moveDetails, loading, error, versionGroup }: Props) {
  const { levelUpRows, machineRows, eggRows, tutorRows } = useMemo(() => {
    if (!learnset || moveDetails.size === 0) {
      return { levelUpRows: [], machineRows: [], eggRows: [], tutorRows: [] };
    }

    const moves = learnset[versionGroup];
    const machines = getMachines(versionGroup);
    const levelUpRows: MoveRow[] = [];
    const machineRows: MoveRow[] = [];
    const eggRows: MoveRow[] = [];
    const tutorRows: MoveRow[] = [];

    const seenLevelUp = new Map<string, number>();
    const seenMachine = new Set<string>();
    const seenEgg = new Set<string>();
    const seenTutor = new Set<string>();

    for (const lm of moves) {
      const detail = moveDetails.get(lm.move);
      if (!detail) continue;
      if (lm.method === "level-up") {
        const prev = seenLevelUp.get(lm.move);
        if (prev === undefined || lm.level < prev) seenLevelUp.set(lm.move, lm.level);
      } else if (lm.method === "machine") {
        seenMachine.add(lm.move);
      } else if (lm.method === "egg") {
        seenEgg.add(lm.move);
      } else if (lm.method === "tutor") {
        seenTutor.add(lm.move);
      }
    }

    for (const [slug, level] of seenLevelUp) {
      levelUpRows.push({ label: level === 0 ? "—" : `Lv ${level}`, move: slug, detail: moveDetails.get(slug)! });
    }
    levelUpRows.sort((a, b) => {
      const la = parseInt(a.label!.replace("Lv ", "")) || 0;
      const lb = parseInt(b.label!.replace("Lv ", "")) || 0;
      return la !== lb ? la - lb : a.detail.displayName.localeCompare(b.detail.displayName);
    });

    for (const slug of seenMachine) {
      machineRows.push({ label: machines[slug] ?? "??", move: slug, detail: moveDetails.get(slug)! });
    }
    machineRows.sort((a, b) => {
      const aHM = a.label!.startsWith("H");
      const bHM = b.label!.startsWith("H");
      if (aHM !== bHM) return aHM ? 1 : -1;
      return parseInt(a.label!.slice(2)) - parseInt(b.label!.slice(2));
    });

    for (const slug of seenEgg) eggRows.push({ move: slug, detail: moveDetails.get(slug)! });
    eggRows.sort((a, b) => a.detail.displayName.localeCompare(b.detail.displayName));

    for (const slug of seenTutor) tutorRows.push({ move: slug, detail: moveDetails.get(slug)! });
    tutorRows.sort((a, b) => a.detail.displayName.localeCompare(b.detail.displayName));

    return { levelUpRows, machineRows, eggRows, tutorRows };
  }, [learnset, moveDetails, versionGroup]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
      <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      <span className="text-sm">Fetching move data…</span>
    </div>
  );
  if (error) return (
    <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg p-3">
      Failed to load moves: {error}
    </div>
  );
  if (!learnset) return null;

  const useGen3Split = GEN3_SPLIT_VERSION_GROUPS.has(versionGroup as Gen3VersionGroup);

  const noMoves = levelUpRows.length === 0 && machineRows.length === 0 && eggRows.length === 0 && tutorRows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {noMoves ? (
        <p className="text-sm text-gray-500 italic">None in this version group.</p>
      ) : (
        <>
          {levelUpRows.length > 0 && (
            <div>
              <SectionHeading>Level-Up Moves</SectionHeading>
              <MoveTable rows={levelUpRows} showLabel labelHeader="Lv" useGen3Split={useGen3Split} />
            </div>
          )}
          {machineRows.length > 0 && (
            <div>
              <SectionHeading>TM / HM Moves</SectionHeading>
              <MoveTable rows={machineRows} showLabel labelHeader="TM/HM" useGen3Split={useGen3Split} />
            </div>
          )}
          {eggRows.length > 0 && (
            <div>
              <SectionHeading>Egg Moves</SectionHeading>
              <MoveTable rows={eggRows} showLabel={false} labelHeader="" useGen3Split={useGen3Split} />
            </div>
          )}
          {tutorRows.length > 0 && (
            <div>
              <SectionHeading>Move Tutor</SectionHeading>
              <MoveTable rows={tutorRows} showLabel={false} labelHeader="" useGen3Split={useGen3Split} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
