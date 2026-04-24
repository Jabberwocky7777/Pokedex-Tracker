import { useState } from "react";
import { Columns2, X } from "lucide-react";
import DesignerPcBox from "./DesignerPcBox";
import DesignerPanel from "./DesignerPanel";
import DesignerPokemonPicker from "./DesignerPokemonPicker";
import StatBlock from "./StatBlock";
import Header from "../layout/Header";
import { useDesignerStore } from "../../store/useDesignerStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { Pokemon, MetaData } from "../../types";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

export default function DesignerTab({ allPokemon, meta }: Props) {
  const { activeGeneration, compareSlotIndex, setCompareSlotIndex } = useSettingsStore();
  const { slots, activeSlotIndex, updateSlot, setActiveSlot } = useDesignerStore();
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [showComparePicker, setShowComparePicker] = useState(false);

  const hasActiveSlot = activeSlotIndex !== null;
  const pokemonMap = new Map(allPokemon.map((p) => [p.id, p]));

  function handlePickPokemon(slotIndex: number) {
    setPickerSlot(slotIndex);
    setActiveSlot(slotIndex);
  }

  function handleSelectPokemon(pokemonId: number, slotIndex: number) {
    updateSlot(slotIndex, { pokemonId });
    setActiveSlot(slotIndex);
  }

  function openCompare(idx: number) {
    setCompareSlotIndex(idx);
    setShowComparePicker(false);
  }

  function closeCompare() {
    setCompareSlotIndex(null);
    setShowComparePicker(false);
  }

  // Occupied slots other than the active one
  const comparableSlotsExist = slots.some(
    (s, i) => i !== activeSlotIndex && s.pokemonId !== null
  );

  const inCompareMode = hasActiveSlot && compareSlotIndex !== null;

  return (
    <div className="flex flex-col h-full">
      <Header meta={meta} />

      {!hasActiveSlot ? (
        // ── No slot selected: PC box fills the whole screen ──────────────────
        <div className="flex-1 overflow-y-auto pb-[76px] md:pb-0">
          <DesignerPcBox
            allPokemon={allPokemon}
            activeGeneration={activeGeneration}
            onPickPokemon={handlePickPokemon}
            fullScreen
          />
        </div>
      ) : inCompareMode ? (
        // ── Compare mode: two StatBlock columns side by side ─────────────────
        <>
          <DesignerPcBox
            allPokemon={allPokemon}
            activeGeneration={activeGeneration}
            onPickPokemon={handlePickPokemon}
          />
          <div className="flex-1 overflow-y-auto pb-[76px] md:pb-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
              {([activeSlotIndex, compareSlotIndex] as number[]).map((idx, col) => {
                const s = slots[idx];
                const mon = s?.pokemonId != null ? pokemonMap.get(s.pokemonId) ?? null : null;
                return (
                  <div key={idx} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col gap-4">
                    {/* Column header */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-300 truncate">
                        {s?.nickname || mon?.displayName || `Slot ${idx + 1}`}
                      </span>
                      {col === 1 && (
                        <button
                          onClick={closeCompare}
                          className="text-gray-500 hover:text-white transition-colors flex-shrink-0 ml-2"
                          title="Close compare"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    {s && mon ? (
                      <StatBlock
                        key={idx}
                        slot={s}
                        pokemon={mon}
                        activeGeneration={activeGeneration}
                        onUpdate={(patch) => updateSlot(idx, patch)}
                      />
                    ) : (
                      <p className="text-gray-600 text-sm text-center py-4">No Pokémon in this slot</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        // ── Single slot: slim PC box header + designer panel ─────────────────
        <>
          <DesignerPcBox
            allPokemon={allPokemon}
            activeGeneration={activeGeneration}
            onPickPokemon={handlePickPokemon}
          />

          {/* Compare toolbar */}
          {comparableSlotsExist && (
            <div className="relative flex-shrink-0 px-3 pt-2 pb-0">
              <button
                onClick={() => setShowComparePicker((v) => !v)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  showComparePicker
                    ? "bg-indigo-700 border-indigo-500 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
                }`}
              >
                <Columns2 size={13} />
                Compare
              </button>

              {/* Slot picker dropdown */}
              {showComparePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowComparePicker(false)} />
                  <div className="absolute top-full left-3 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-2 flex flex-wrap gap-1.5 max-w-xs">
                    {slots.map((s, i) => {
                      if (i === activeSlotIndex || s.pokemonId === null) return null;
                      const mon = pokemonMap.get(s.pokemonId!);
                      if (!mon) return null;
                      const sprite = activeGeneration === 4 ? mon.gen4Sprite : mon.gen3Sprite;
                      return (
                        <button
                          key={i}
                          onClick={() => openCompare(i)}
                          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                          title={s.nickname || mon.displayName}
                        >
                          <img
                            src={sprite || mon.spriteUrl}
                            alt={mon.displayName}
                            className="w-8 h-8 object-contain pixelated"
                          />
                          <span className="text-[10px] text-gray-400 max-w-[48px] truncate">
                            {s.nickname || mon.displayName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto pb-[76px] md:pb-0">
            <DesignerPanel
              key={activeSlotIndex ?? -1}
              allPokemon={allPokemon}
              meta={meta}
              activeGeneration={activeGeneration}
            />
          </div>
        </>
      )}

      {pickerSlot !== null && (
        <DesignerPokemonPicker
          allPokemon={allPokemon}
          activeGeneration={activeGeneration}
          onSelect={(pokemonId) => handleSelectPokemon(pokemonId, pickerSlot)}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
