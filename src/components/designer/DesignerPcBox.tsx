import { useState } from "react";
import { Plus, X, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { useDesignerStore } from "../../store/useDesignerStore";
import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";
import { NATURES } from "../../lib/iv-calc";

interface Props {
  allPokemon: Pokemon[];
  activeGeneration: number;
  onPickPokemon: (slotIndex: number) => void;
  /** When true, fills the page like the tracker BoxView. When false, renders as a slim accordion. */
  fullScreen?: boolean;
}

export default function DesignerPcBox({ allPokemon, activeGeneration, onPickPokemon, fullScreen = false }: Props) {
  const { slots, activeSlotIndex, setActiveSlot, clearSlot, duplicateSlot } = useDesignerStore();
  const [menuSlot, setMenuSlot] = useState<number | null>(null);
  const [accordionOpen, setAccordionOpen] = useState(false);

  const pokemonMap = new Map(allPokemon.map((p) => [p.id, p]));

  const activeSlot = activeSlotIndex !== null ? slots[activeSlotIndex] : null;
  const activePokemon = activeSlot?.pokemonId != null ? pokemonMap.get(activeSlot.pokemonId) : null;

  function handleContextMenu(e: React.MouseEvent, index: number) {
    e.preventDefault();
    setMenuSlot(index);
  }

  function handleDuplicate(fromIndex: number) {
    const emptyTarget = slots.findIndex((s, i) => i !== fromIndex && s.pokemonId === null);
    if (emptyTarget !== -1) duplicateSlot(fromIndex, emptyTarget);
    setMenuSlot(null);
  }

  const BOX_SIZE = 30;
  const COLS = 6;
  const numBoxes = Math.ceil(slots.length / BOX_SIZE);

  // ── Slot grid (shared between full-screen and accordion-expanded modes) ────────
  function renderBoxes(slotSizeClass: string) {
    return (
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: numBoxes }, (_, boxIdx) => {
          const start = boxIdx * BOX_SIZE;
          const boxSlots = slots.slice(start, start + BOX_SIZE);

          return (
            <div key={boxIdx}>
              <div className="text-xs text-gray-500 font-mono mb-2 px-1">Box {boxIdx + 1}</div>
              <div
                className="grid gap-1.5 bg-gray-800/30 rounded-xl p-3"
                style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
              >
                {boxSlots.map((slot, localIdx) => {
                  const index = start + localIdx;
                  const pokemon = slot.pokemonId != null ? pokemonMap.get(slot.pokemonId) : null;
                  const nature = NATURES.find((n) => n.name === slot.natureName);
                  const isActive = activeSlotIndex === index;

                  if (!pokemon) {
                    return (
                      <button
                        key={index}
                        onClick={() => onPickPokemon(index)}
                        className={`${slotSizeClass} flex items-center justify-center border-2 border-dashed rounded-lg text-gray-600 hover:text-gray-400 hover:border-gray-500 transition-colors ${
                          isActive ? "border-indigo-500 bg-indigo-900/20" : "border-gray-700"
                        }`}
                        title={`Slot ${index + 1}`}
                      >
                        <Plus size={14} />
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
                        isActive
                          ? "border-indigo-500 bg-indigo-900/30"
                          : "border-transparent hover:border-gray-600 hover:bg-gray-800/50"
                      }`}
                      onClick={() => setActiveSlot(isActive ? null : index)}
                      onContextMenu={(e) => handleContextMenu(e, index)}
                      title={slot.nickname || pokemon.displayName}
                    >
                      {sprite && (
                        <img src={sprite} alt="" className="w-8 h-8 object-contain pixelated" draggable={false} />
                      )}
                      {!isNeutral && (
                        <span
                          className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                            hasPlusNature && !hasMinusNature ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                      )}

                      <button
                        className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-600 text-white z-10"
                        onClick={(e) => { e.stopPropagation(); clearSlot(index); }}
                        title="Clear slot"
                      >
                        <X size={8} />
                      </button>

                      {menuSlot === index && (
                        <>
                          <div className="fixed inset-0 z-50" onClick={() => setMenuSlot(null)} />
                          <div className="absolute top-full left-0 z-50 mt-0.5 bg-gray-800 border border-gray-700 rounded shadow-xl text-xs min-w-[110px]">
                            <button
                              className="w-full text-left px-3 py-1.5 hover:bg-gray-700 flex items-center gap-1.5 text-gray-200"
                              onClick={(e) => { e.stopPropagation(); handleDuplicate(index); }}
                            >
                              <Copy size={11} /> Duplicate
                            </button>
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
            </div>
          );
        })}
      </div>
    );
  }

  // ── Full-screen mode (no slot active) ─────────────────────────────────────────
  if (fullScreen) {
    return (
      <div className="p-4">
        {renderBoxes("w-12 h-12")}
      </div>
    );
  }

  // ── Accordion mode (slot active — slim header, optionally expandable) ─────────
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
        <div className="px-3 pb-3 overflow-x-auto">
          {renderBoxes("w-10 h-10")}
        </div>
      )}
    </div>
  );
}
