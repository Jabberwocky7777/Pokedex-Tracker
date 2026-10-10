import { useState, useEffect, useRef } from "react";
import { X, AlertTriangle } from "lucide-react";
import { fetchLearnset, fetchMoveDetail, moveForVersionGroup } from "../../lib/move-fetch";
import type { PokemonLearnset, MoveDetail, VersionGroup } from "../../lib/move-fetch";
import TypeBadge from "../shared/TypeBadge";

interface Props {
  pokemonId: number;
  versionGroup: VersionGroup;
  slotIndex: number;
  onSelect: (moveSlug: string) => void;
  onClose: () => void;
}

interface EnrichedMove {
  slug: string;
  detail: MoveDetail | null;
  level: number;
  method: string;
}

export default function MovePicker({ pokemonId, versionGroup, slotIndex, onSelect, onClose }: Props) {
  const [learnset, setLearnset] = useState<PokemonLearnset | null>(null);
  const [moveDetails, setMoveDetails] = useState<Map<string, MoveDetail>>(new Map());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchLearnset(pokemonId).then(async (ls) => {
      if (cancelled) return;
      setLearnset(ls);
      const vgMoves = ls[versionGroup] ?? [];
      const slugs = [...new Set(vgMoves.map((m) => m.move))];
      const details = new Map<string, MoveDetail>();
      await Promise.all(
        slugs.map(async (slug) => {
          try {
            const d = await fetchMoveDetail(slug);
            details.set(slug, d);
          } catch { /* skip */ }
        })
      );
      if (!cancelled) {
        setMoveDetails(details);
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pokemonId, versionGroup]);

  const moves = learnset?.[versionGroup] ?? [];

  const groups = ["level-up", "machine", "egg", "tutor"] as const;
  const methodLabels: Record<string, string> = {
    "level-up": "Level Up",
    "machine": "TM / HM",
    "egg": "Egg Moves",
    "tutor": "Move Tutor",
  };

  const enriched: EnrichedMove[] = moves.map((m) => ({
    slug: m.move,
    detail: moveDetails.has(m.move) ? moveForVersionGroup(moveDetails.get(m.move)!, versionGroup) : null,
    level: m.level,
    method: m.method,
  }));

  const filtered = enriched.filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      m.slug.includes(q) ||
      (m.detail?.displayName.toLowerCase().includes(q) ?? false)
    );
  });

  const grouped = groups.map((method) => ({
    method,
    label: methodLabels[method] ?? method,
    moves: filtered.filter((m) => m.method === method)
      .sort((a, b) => a.level - b.level || a.slug.localeCompare(b.slug)),
  })).filter((g) => g.moves.length > 0);

  const otherMoves = filtered.filter((m) => !groups.includes(m.method as typeof groups[number]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Pick move for slot ${slotIndex + 1}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm font-semibold text-white">Pick Move — Slot {slotIndex + 1}</span>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-200"><X size={16} /></button>
        </div>

        <div className="px-3 py-2 border-b border-gray-700">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search moves…"
            aria-label="Search moves"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading learnset…</p>
          ) : grouped.length === 0 && otherMoves.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No moves found</p>
          ) : (
            <>
              {grouped.map((g) => (
                <div key={g.method}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-800/50 sticky top-0">
                    {g.label}
                  </div>
                  {g.moves.map((m) => (
                    <MoveRow key={`${m.slug}-${m.method}`} move={m} onSelect={() => { onSelect(m.slug); onClose(); }} />
                  ))}
                </div>
              ))}
              {otherMoves.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-800/50 sticky top-0">Other</div>
                  {otherMoves.map((m) => (
                    <MoveRow key={`${m.slug}-${m.method}`} move={m} onSelect={() => { onSelect(m.slug); onClose(); }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MoveRow({ move, onSelect }: { move: EnrichedMove; onSelect: () => void }) {
  const d = move.detail;
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 transition-colors text-left text-xs"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-200">
          {d?.displayName ?? move.slug}
          {move.level > 0 && (
            <span className="ml-2 text-gray-500">Lv. {move.level}</span>
          )}
        </div>
      </div>
      {d ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TypeBadge type={d.type} size="sm" />
          {d.power != null && <span className="text-gray-400">{d.power}</span>}
          {d.accuracy != null && <span className="text-gray-500">{d.accuracy}%</span>}
        </div>
      ) : (
        <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
      )}
    </button>
  );
}
