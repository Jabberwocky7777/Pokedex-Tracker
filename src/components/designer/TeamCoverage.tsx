import { useEffect, useMemo, useState } from "react";
import type { Pokemon } from "../../types";
import type { DesignerSlot } from "../../store/useDesignerStore";
import { useDesignerStore } from "../../store/useDesignerStore";
import { defenceTable, offenceCoverage } from "../../lib/team-coverage";
import { fetchMoveDetail, moveForVersionGroup } from "../../lib/move-fetch";
import TypeBadge from "../shared/TypeBadge";
import SegmentedControl from "../shared/SegmentedControl";

interface Props {
  pokemonMap: Map<number, Pokemon>;
}

const ROWS = 5;
const PER_ROW = 6;

/**
 * F7: one row of the open Designer box (six slots) as a team — the attacking
 * types several members are weak to and few resist, and what the members'
 * damaging moves hit hard or can't touch.
 */
export default function TeamCoverage({ pokemonMap }: Props) {
  const box = useDesignerStore((s) => s.activeBoxIndex);
  const slots = useDesignerStore((s) => s.slots);
  const rowsWithTeams = useMemo(
    () =>
      Array.from({ length: ROWS }, (_, row) =>
        slots.slice(box * 30 + row * PER_ROW, box * 30 + (row + 1) * PER_ROW).filter((s) => s.pokemonId !== null),
      ),
    [slots, box],
  );
  const firstRow = Math.max(
    0,
    rowsWithTeams.findIndex((r) => r.length > 0),
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const row = chosen ?? firstRow;
  const team = rowsWithTeams[row];

  const members = useMemo(
    () =>
      team.flatMap((s) => {
        const p = pokemonMap.get(s.pokemonId!);
        return p ? [{ slot: s, pokemon: p }] : [];
      }),
    [team, pokemonMap],
  );
  const defence = useMemo(() => defenceTable(members.map((m) => m.pokemon.types)), [members]);
  const moveTypes = useMoveTypes(team);
  const offence = useMemo(() => offenceCoverage(moveTypes), [moveTypes]);

  if (rowsWithTeams.every((r) => r.length === 0)) return null;
  const holes = defence.filter((r) => r.shared);

  return (
    <section
      className="rounded-xl bg-gray-900 border border-gray-800 p-4 flex flex-col gap-3"
      data-testid="team-coverage"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>
            Team view
          </h2>
          <p className="text-xs text-gray-400">A row of this box as a team of six: what it fears and what it hits.</p>
        </div>
        <SegmentedControl
          ariaLabel="Box row"
          size="sm"
          value={row}
          onChange={setChosen}
          options={rowsWithTeams.map((r, i) => ({ value: i, label: `Row ${i + 1}`, disabled: r.length === 0 }))}
        />
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-gray-400">This row is empty.</p>
      ) : (
        <>
          <p className="text-sm text-gray-300">{members.map((m) => m.pokemon.displayName).join(", ")}</p>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Weak to</h3>
            {holes.length === 0 ? (
              <p className="text-sm text-gray-300">No type hits more of the team hard than it resists. </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {holes.map((r) => (
                  <li key={r.type} className="flex items-center gap-1.5 text-sm text-gray-200">
                    <TypeBadge type={r.type} size="sm" />
                    <span className="text-red-300">{r.weak} weak</span>
                    <span className="text-gray-400">· {r.resist} resist</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Moves hit hard</h3>
            {moveTypes.length === 0 ? (
              <p className="text-sm text-gray-400">Pick damaging moves in the slots to see their coverage.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {offence.superEffective.map((t) => (
                    <TypeBadge key={t} type={t} size="sm" />
                  ))}
                </div>
                {offence.walled.length > 0 && (
                  <p className="text-sm text-gray-300 flex flex-wrap items-center gap-1.5">
                    <span className="text-amber-200">Nothing hits these for more than ½×:</span>
                    {offence.walled.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" />
                    ))}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** The types of the team's damaging moves, as in each slot's game (moves.json loads on first use) */
function useMoveTypes(team: DesignerSlot[]): string[] {
  const key = team.map((s) => `${s.selectedVersionGroup}:${s.selectedMoves.join(",")}`).join("|");
  const [types, setTypes] = useState<{ key: string; types: string[] }>({ key: "", types: [] });
  useEffect(() => {
    let cancelled = false;
    const wanted = team.flatMap((s) =>
      s.selectedMoves.filter((m): m is string => !!m).map((slug) => ({ slug, vg: s.selectedVersionGroup })),
    );
    void Promise.all(
      wanted.map(({ slug, vg }) =>
        fetchMoveDetail(slug)
          .then((d) => moveForVersionGroup(d, vg))
          .then((d) => (d.category !== "status" && (d.power ?? 0) > 0 ? d.type : null))
          .catch(() => null),
      ),
    ).then((list) => {
      if (!cancelled) setTypes({ key, types: list.filter((t): t is string => !!t) });
    });
    return () => {
      cancelled = true;
    };
    // The key stands for the team's moves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return types.key === key ? types.types : [];
}
