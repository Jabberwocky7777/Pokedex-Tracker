import { MoveLink } from "../shared/links";
import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { fetchLearnset, fetchMoveDetail, moveForVersionGroup, versionGroupsFor } from "../../lib/move-fetch";
import type { MoveDetail, VersionGroup } from "../../lib/move-fetch";
import type { DesignerSlot } from "../../store/useDesignerStore";
import TypeBadge from "../shared/TypeBadge";
import MovePicker from "./MovePicker";

interface Props {
  slot: DesignerSlot;
  pokemonId: number;
  activeGeneration: number;
  onUpdate: (patch: Partial<DesignerSlot>) => void;
}

export default function MoveGrid({ slot, pokemonId, activeGeneration, onUpdate }: Props) {
  const [moveDetails, setMoveDetails] = useState<Map<string, MoveDetail>>(new Map());
  const [learnableSlugs, setLearnableSlugs] = useState<Set<string>>(new Set());
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [loadingLearnset, setLoadingLearnset] = useState(false);

  const vgOptions = versionGroupsFor(activeGeneration);
  // The slot remembers a game; if that game isn't in the generation being viewed, use its first one
  const versionGroup = vgOptions.some((vg) => vg.id === slot.selectedVersionGroup) ? slot.selectedVersionGroup : vgOptions[0].id;

  useEffect(() => {
    let cancelled = false;
    setLoadingLearnset(true);
    fetchLearnset(pokemonId).then(async (ls) => {
      if (cancelled) return;
      const vgMoves = ls[versionGroup] ?? [];
      setLearnableSlugs(new Set(vgMoves.map((m) => m.move)));

      const allSlugs = new Set<string>();
      slot.selectedMoves.forEach((s) => { if (s) allSlugs.add(s); });
      vgMoves.forEach((m) => allSlugs.add(m.move));

      const details = new Map<string, MoveDetail>(moveDetails);
      await Promise.all(
        [...allSlugs].filter((s) => !details.has(s)).map(async (slug) => {
          try {
            const d = await fetchMoveDetail(slug);
            details.set(slug, d);
          } catch { /* skip */ }
        })
      );
      if (!cancelled) {
        setMoveDetails(new Map(details));
        setLoadingLearnset(false);
      }
    }).catch(() => { if (!cancelled) setLoadingLearnset(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokemonId, versionGroup]);

  function setVersionGroup(vg: VersionGroup) {
    onUpdate({ selectedVersionGroup: vg });
  }

  function clearMove(slotIdx: number) {
    const moves = [...slot.selectedMoves];
    moves[slotIdx] = null;
    onUpdate({ selectedMoves: moves });
  }

  function assignMove(slotIdx: number, slug: string) {
    const moves = [...slot.selectedMoves];
    moves[slotIdx] = slug;
    onUpdate({ selectedMoves: moves });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Version group selector */}
      <div className="flex gap-1 flex-wrap">
        {vgOptions.map((vg) => (
          <button
            key={vg.id}
            onClick={() => setVersionGroup(vg.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              versionGroup === vg.id
                ? "bg-white text-gray-900"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {vg.label}
          </button>
        ))}
      </div>

      {/* 2×2 move grid */}
      <div className="grid grid-cols-2 gap-2">
        {slot.selectedMoves.map((moveSlug, i) => {
          const fetched = moveSlug ? moveDetails.get(moveSlug) : null;
          const detail = fetched ? moveForVersionGroup(fetched, versionGroup) : null;
          const notLearnable = moveSlug != null && !learnableSlugs.has(moveSlug);

          return (
            <div
              key={`move-slot-${i}`}
              className={`rounded border p-2 min-h-[70px] flex flex-col gap-1 ${
                moveSlug
                  ? "border-gray-700 bg-gray-800/50"
                  : "border-dashed border-gray-700 cursor-pointer hover:border-gray-500"
              }`}
              onClick={() => !moveSlug && setPickerSlot(i)}
            >
              {moveSlug ? (
                <>
                  <div className="flex items-start justify-between gap-1">
                    <MoveLink slug={moveSlug} className="text-sm text-gray-100 font-medium leading-tight">
                      {detail?.displayName ?? moveSlug}
                    </MoveLink>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {notLearnable && (
                        <span title="Not learnable in selected game">
                          <AlertTriangle size={12} className="text-amber-400" />
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); clearMove(i); }}
                        className="text-gray-600 hover:text-gray-300"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {detail && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <TypeBadge type={detail.type} size="sm" />
                      {detail.power != null && (
                        <span className="text-xs text-gray-400">{detail.power} BP</span>
                      )}
                      {detail.accuracy != null && (
                        <span className="text-xs text-gray-500">{detail.accuracy}%</span>
                      )}
                      <span className="text-xs text-gray-600">PP {detail.pp}</span>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setPickerSlot(i); }}
                    className="text-xs text-gray-500 hover:text-gray-300 text-left mt-auto"
                  >
                    Change
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                  {loadingLearnset ? "…" : "— tap to add —"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pickerSlot !== null && (
        <MovePicker
          pokemonId={pokemonId}
          versionGroup={versionGroup}
          slotIndex={pickerSlot}
          onSelect={(slug) => assignMove(pickerSlot, slug)}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
