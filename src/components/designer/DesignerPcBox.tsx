import { useState, useMemo } from "react";
import { Plus, X, Copy, ClipboardPaste, ChevronDown, ChevronUp } from "lucide-react";
import { useDesignerStore } from "../../store/useDesignerStore";
import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";
import { NATURES } from "../../lib/iv-calc";

interface Props {
  allPokemon: Pokemon[];
  activeGeneration: number;
  onPickPokemon: (slotIndex: number) => void;
  copiedSlotIndex?: number | null;
  onCopySlot?: (index: number) => void;
  onPasteToSlot?: (toIndex: number) => void;
  /** When true, fills the page like the tracker BoxView. When false, renders as a slim accordion. */
  fullScreen?: boolean;
}

const SLOTS_PER_BOX = 30;
const COLS = 6;
const BOX_LABELS = ["Box 1", "Box 2", "Box 3"] as const;

export default function DesignerPcBox({
  allPokemon,
  activeGeneration,
  onPickPokemon,
  copiedSlotIndex = null,
  onCopySlot,
  onPasteToSlot,
  fullScreen = false,
}: Props) {
  const slots = useDesignerStore((s) => s.slots);
  const activeSlotIndex = useDesignerStore((s) => s.activeSlotIndex);
  const activeBoxIndex = useDesignerStore((s) => s.activeBoxIndex);
  const setActiveSlot = useDesignerStore((s) => s.setActiveSlot);
  const setActiveBox = useDesignerStore((s) => s.setActiveBox);
  const clearSlot = useDesignerStore((s) => s.clearSlot);
  const [menuSlot, setMenuSlot] = useState<number | null>(null);
  const [accordionOpen, setAccordionOpen] = useState(false);

  const pokemonMap = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);

  const activeSlot = activeSlotIndex !== null ? slots[activeSlotIndex] : null;
  const activePokemon = activeSlot?.pokemonId != null ? pokemonMap.get(activeSlot.pokemonId) : null;

  function handleContextMenu(e: React.MouseEvent, index: number) {
    e.preventDefault();
    setMenuSlot(index);
  }

  // The 30 slots for the currently visible box
  const boxStart = activeBoxIndex * SLOTS_PER_BOX;
  const visibleSlots = slots.slice(boxStart, boxStart + SLOTS_PER_BOX);
  const isPasting = copiedSlotIndex !== null;

  function renderBoxTabs() {
    return (
      <div className="flex gap-1 mb-3">
        {BOX_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setActiveBox(i as 0 | 1 | 2)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeBoxIndex === i
                ? "bg-white text-gray-900"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  function renderGrid() {
    const slotSizeClass = "w-full aspect-square";
    return (
      <>
        {isPasting && (
          <div className="w-full text-xs text-indigo-300 bg-indigo-900/30 border border-indigo-700 rounded px-3 py-1.5 flex items-center justify-between mb-2">
            <span>Click a slot to paste. Right-click for more options.</span>
            <button onClick={() => onCopySlot?.(copiedSlotIndex!)} className="text-gray-400 hover:text-white ml-3">
              <X size={12} />
            </button>
          </div>
        )}
        {/* Fluid: six columns that shrink with the screen, up to the old 3.5rem / 3rem cells */}
        <div
          className={`grid gap-1.5 bg-gray-800/30 rounded-xl p-2 sm:p-3 w-full mx-auto ${fullScreen ? "max-w-[24rem]" : "max-w-[21rem]"}`}
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {visibleSlots.map((slot, localIdx) => {
            const index = boxStart + localIdx;
            const pokemon = slot.pokemonId != null ? pokemonMap.get(slot.pokemonId) : null;
            const nature = NATURES.find((n) => n.name === slot.natureName);
            const isActive = activeSlotIndex === index;
            const isCopied = copiedSlotIndex === index;
            const isPasteTarget = isPasting && index !== copiedSlotIndex;

            if (!pokemon) {
              return (
                <button
                  key={index}
                  onClick={() => isPasteTarget ? onPasteToSlot?.(index) : onPickPokemon(index)}
                  className={`${slotSizeClass} flex items-center justify-center border-2 border-dashed rounded-lg transition-colors ${
                    isPasteTarget
                      ? "border-indigo-400 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50"
                      : isActive
                      ? "border-indigo-500 bg-indigo-900/20 text-gray-600"
                      : "border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-500"
                  }`}
                  title={isPasteTarget ? "Paste here" : `Slot ${index + 1}`}
                >
                  {isPasteTarget ? <ClipboardPaste size={14} /> : <Plus size={14} />}
                </button>
              );
            }

            const sprite = getGenSprite(pokemon, activeGeneration);
            const hasPlusNature = nature?.plus != null;
            const hasMinusNature = nature?.minus != null;
            const isNeutral = !hasPlusNature && !hasMinusNature;

            return (
              <div
                key={index}
                className={`relative ${slotSizeClass} flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors border group ${
                  isCopied
                    ? "border-indigo-400 bg-indigo-900/40 ring-1 ring-indigo-400"
                    : isActive
                    ? "border-indigo-500 bg-indigo-900/30"
                    : isPasteTarget
                    ? "border-indigo-400/50 hover:border-indigo-400 hover:bg-indigo-900/20"
                    : "border-transparent hover:border-gray-600 hover:bg-gray-800/50"
                }`}
                onClick={() => {
                  if (isPasteTarget) {
                    onPasteToSlot?.(index);
                  } else {
                    setActiveSlot(isActive ? null : index);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, index)}
                title={isPasteTarget ? `Paste onto ${slot.nickname || pokemon.displayName}` : (slot.nickname || pokemon.displayName)}
              >
                {sprite && (
                  <img src={sprite} alt={slot.nickname || pokemon.displayName} className="w-8 h-8 object-contain pixelated" draggable={false} />
                )}
                {!isNeutral && !isPasteTarget && (
                  <span
                    className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                      hasPlusNature && !hasMinusNature ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                )}
                {isPasteTarget && (
                  <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/60 rounded-lg">
                    <ClipboardPaste size={16} className="text-indigo-300" />
                  </div>
                )}

                {!isPasteTarget && (
                  <button
                    className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-600 text-white z-10"
                    onClick={(e) => { e.stopPropagation(); clearSlot(index); }}
                    title="Clear slot"
                  >
                    <X size={8} />
                  </button>
                )}

                {menuSlot === index && (
                  <>
                    <div className="fixed inset-0 z-50" onClick={() => setMenuSlot(null)} />
                    <div className="absolute top-full left-0 z-50 mt-0.5 bg-gray-800 border border-gray-700 rounded shadow-xl text-xs min-w-[120px]">
                      <button
                        className="w-full text-left px-3 py-1.5 hover:bg-gray-700 flex items-center gap-1.5 text-gray-200"
                        onClick={(e) => { e.stopPropagation(); onCopySlot?.(index); setMenuSlot(null); }}
                      >
                        <Copy size={11} /> {isCopied ? "Cancel copy" : "Copy slot"}
                      </button>
                      {isPasting && index !== copiedSlotIndex && (
                        <button
                          className="w-full text-left px-3 py-1.5 hover:bg-gray-700 flex items-center gap-1.5 text-indigo-300"
                          onClick={(e) => { e.stopPropagation(); onPasteToSlot?.(index); setMenuSlot(null); }}
                        >
                          <ClipboardPaste size={11} /> Paste here
                        </button>
                      )}
                      <button
                        className="w-full text-left px-3 py-1.5 hover:bg-gray-700 flex items-center gap-1.5 text-red-400"
                        onClick={(e) => { e.stopPropagation(); clearSlot(index); setMenuSlot(null); }}
                      >
                        <X size={11} /> Clear slot
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // ── Full-screen mode ──────────────────────────────────────────────────────────
  if (fullScreen) {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6">
        {renderBoxTabs()}
        {renderGrid()}
      </div>
    );
  }

  // ── Accordion mode (slot active) ──────────────────────────────────────────────
  const headerLabel = activePokemon
    ? `Editing: ${activeSlot?.nickname || activePokemon.displayName}`
    : "Designer Slots";

  return (
    <div className="bg-gray-900 border-b border-gray-800 flex-shrink-0">
      <button
        onClick={() => setAccordionOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-semibold">{headerLabel}</span>
        {accordionOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {accordionOpen && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-4">
          {renderBoxTabs()}
          {renderGrid()}
        </div>
      )}
    </div>
  );
}
