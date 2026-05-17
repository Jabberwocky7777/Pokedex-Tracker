import { useState, useMemo } from "react";
import { Columns2, X } from "lucide-react";
import DesignerPcBox from "./DesignerPcBox";
import DesignerPanel from "./DesignerPanel";
import DesignerPokemonPicker from "./DesignerPokemonPicker";
import Header from "../layout/Header";
import { useDesignerStore } from "../../store/useDesignerStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { Pokemon, MetaData } from "../../types";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

export default function DesignerTab({ allPokemon, meta }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const compareSlotIndex = useSettingsStore((s) => s.compareSlotIndex);
  const setCompareSlotIndex = useSettingsStore((s) => s.setCompareSlotIndex);
  const slots = useDesignerStore((s) => s.slots);
  const activeSlotIndex = useDesignerStore((s) => s.activeSlotIndex);
  const updateSlot = useDesignerStore((s) => s.updateSlot);
  const setActiveSlot = useDesignerStore((s) => s.setActiveSlot);
  const copySlotTo = useDesignerStore((s) => s.copySlotTo);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [showComparePicker, setShowComparePicker] = useState(false);
  const [copiedSlotIndex, setCopiedSlotIndex] = useState<number | null>(null);

  const hasActiveSlot = activeSlotIndex !== null;
  const pokemonMap = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);

  function handlePickPokemon(slotIndex: number) {
    setPickerSlot(slotIndex);
    setActiveSlot(slotIndex);
  }

  function handleSelectPokemon(pokemonId: number, slotIndex: number) {
    updateSlot(slotIndex, { pokemonId });
    setActiveSlot(slotIndex);
  }

  function handleCopySlot(index: number) {
    setCopiedSlotIndex((prev) => (prev === index ? null : index));
  }

  function handlePasteToSlot(toIndex: number) {
    if (copiedSlotIndex === null || copiedSlotIndex === toIndex) return;
    copySlotTo(copiedSlotIndex, toIndex);
    setCopiedSlotIndex(null);
  }

  function openCompare(idx: number) {
    setCompareSlotIndex(idx);
    setShowComparePicker(false);
  }

  function closeCompare() {
    setCompareSlotIndex(null);
    setShowComparePicker(false);
  }

  const comparableSlotsExist = slots.some(
    (s, i) => i !== activeSlotIndex && s.pokemonId !== null
  );

  const inCompareMode = hasActiveSlot && compareSlotIndex !== null;

  const pcBoxProps = {
    allPokemon,
    activeGeneration,
    onPickPokemon: handlePickPokemon,
    copiedSlotIndex,
    onCopySlot: handleCopySlot,
    onPasteToSlot: handlePasteToSlot,
  };

  return (
    <div className="flex flex-col h-full">
      <Header />

      {!hasActiveSlot ? (
        // ── No slot selected: PC box fills the whole screen ──────────────────
        <div className="flex-1 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0">
          <DesignerPcBox {...pcBoxProps} fullScreen />
        </div>
      ) : inCompareMode ? (
        // ── Compare mode: two full DesignerPanel columns side by side ────────
        <>
          <DesignerPcBox {...pcBoxProps} />
          <div className="flex-shrink-0 flex items-center justify-end px-3 pt-2">
            <button
              onClick={closeCompare}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
            >
              <X size={13} />
              Close compare
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
              <DesignerPanel
                key={`cmp-${activeSlotIndex}`}
                slotIndex={activeSlotIndex ?? undefined}
                allPokemon={allPokemon}
                activeGeneration={activeGeneration}
                copiedSlotIndex={copiedSlotIndex}
                onCopySlot={handleCopySlot}
                compact
              />
              <DesignerPanel
                key={`cmp-${compareSlotIndex}`}
                slotIndex={compareSlotIndex ?? undefined}
                allPokemon={allPokemon}
                activeGeneration={activeGeneration}
                copiedSlotIndex={copiedSlotIndex}
                onCopySlot={handleCopySlot}
                compact
              />
            </div>
          </div>
        </>
      ) : (
        // ── Single slot: slim PC box header + designer panel ─────────────────
        <>
          <DesignerPcBox {...pcBoxProps} />

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

              {showComparePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowComparePicker(false)} />
                  <div className="absolute top-full left-3 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-2 flex flex-wrap gap-1.5 max-w-xs">
                    {slots.map((s) => {
                      if (s.slotIndex === activeSlotIndex || s.pokemonId === null) return null;
                      const mon = pokemonMap.get(s.pokemonId!);
                      if (!mon) return null;
                      const sprite = activeGeneration === 4 ? mon.gen4Sprite : mon.gen3Sprite;
                      return (
                        <button
                          key={s.slotIndex}
                          onClick={() => openCompare(s.slotIndex)}
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

          <div className="flex-1 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0">
            <DesignerPanel
              key={activeSlotIndex ?? -1}
              allPokemon={allPokemon}
              meta={meta}
              activeGeneration={activeGeneration}
              copiedSlotIndex={copiedSlotIndex}
              onCopySlot={handleCopySlot}
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
