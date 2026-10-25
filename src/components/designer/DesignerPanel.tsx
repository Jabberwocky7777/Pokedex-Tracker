import { useState, useMemo, useRef, useCallback } from "react";
import { ChevronDown, ClipboardCopy, Copy, ArrowRight, X } from "lucide-react";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import StatBlock from "./StatBlock";
import MoveGrid from "./MoveGrid";
import IvSection from "./IvSection";
import EvTracker from "./EvTracker";
import EggMoveFinder from "./EggMoveFinder";
import { versionGroupsFor } from "../../lib/move-fetch";
import { useDesignerStore } from "../../store/useDesignerStore";
import type { DesignerSlot } from "../../store/useDesignerStore";
import type { Pokemon, MetaData } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";
import { buildShowdownExport } from "../../lib/showdown-export";
import { copyText } from "../../lib/clipboard";
import { generationMaxId } from "../../lib/generation";

interface Props {
  allPokemon: Pokemon[];
  meta?: MetaData;
  activeGeneration: number;
  slotIndex?: number;
  compact?: boolean;
  copiedSlotIndex?: number | null;
  onCopySlot?: (index: number) => void;
}

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Accordion({ title, children, defaultOpen = true }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/70 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-gray-200">{title}</span>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export default function DesignerPanel({
  allPokemon,
  activeGeneration,
  slotIndex,
  compact,
  copiedSlotIndex = null,
  onCopySlot,
}: Props) {
  const slots = useDesignerStore((s) => s.slots);
  const activeSlotIndex = useDesignerStore((s) => s.activeSlotIndex);
  const updateSlot = useDesignerStore((s) => s.updateSlot);
  const evolveSlot = useDesignerStore((s) => s.evolveSlot);
  const effectiveIndex = slotIndex ?? activeSlotIndex;
  const slot: DesignerSlot | null = effectiveIndex != null ? slots[effectiveIndex] : null;

  const pokemonMap = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);
  const pokemon = slot?.pokemonId != null ? pokemonMap.get(slot.pokemonId) ?? null : null;

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [showEvolvePicker, setShowEvolvePicker] = useState(false);
  const evolvePickerRef = useRef<HTMLDivElement>(null);
  const closeEvolvePicker = useCallback(() => setShowEvolvePicker(false), [setShowEvolvePicker]);
  useDialogFocus(evolvePickerRef, showEvolvePicker, closeEvolvePicker);

  const isCopied = effectiveIndex != null && copiedSlotIndex === effectiveIndex;

  if (!slot || !pokemon) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm p-8 text-center">
        Select a slot above to start designing
      </div>
    );
  }

  function update(patch: Partial<DesignerSlot>) {
    if (effectiveIndex != null) updateSlot(effectiveIndex, patch);
  }

  function copyToShowdown() {
    if (!slot || !pokemon) return;
    const text = buildShowdownExport(slot, pokemon);
    void copyText(text).then((ok) => {
      setCopyState(ok ? "copied" : "failed");
      setTimeout(() => setCopyState("idle"), 1500);
    });
  }

  function handleEvolve(targetId: number) {
    if (effectiveIndex == null) return;
    evolveSlot(effectiveIndex, targetId);
    setShowEvolvePicker(false);
  }

  // Only species that exist in the active generation and in the app's data
  const maxId = generationMaxId(activeGeneration);
  const evolutions = (pokemon.evolvesTo ?? []).filter((evo) => evo.speciesId <= maxId && pokemonMap.has(evo.speciesId));
  const hasEvolutions = evolutions.length > 0;

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Action row: nickname + buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 w-20 flex-shrink-0">Nickname</span>
        <input
          type="text"
          placeholder={pokemon.displayName}
          value={slot.nickname}
          onChange={(e) => update({ nickname: e.target.value })}
          className="flex-1 min-w-0 px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />

        {/* Copy slot button */}
        {effectiveIndex != null && onCopySlot && (
          <button
            onClick={() => onCopySlot(effectiveIndex)}
            title={isCopied ? "Cancel copy" : "Copy this slot to another slot"}
            className={`flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1.5 rounded border text-xs transition-colors ${
              isCopied
                ? "bg-indigo-800 border-indigo-500 text-indigo-300"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
            }`}
          >
            <Copy size={13} />
            {isCopied ? "Copying…" : "Copy"}
          </button>
        )}

        {/* Evolve button */}
        {hasEvolutions && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => {
                if (evolutions.length === 1) {
                  handleEvolve(evolutions[0].speciesId);
                } else {
                  setShowEvolvePicker((v) => !v);
                }
              }}
              title="Evolve this Pokémon (keeps IVs, EVs, nature, and moves)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              <ArrowRight size={13} />
              Evolve
            </button>

            {showEvolvePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowEvolvePicker(false)} />
                <div ref={evolvePickerRef} role="menu" aria-label="Evolve into" className="absolute top-full right-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[140px]">
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-gray-700 mb-1">
                    <span className="text-xs text-gray-400">Evolve into…</span>
                    <button onClick={() => setShowEvolvePicker(false)} className="text-gray-500 hover:text-gray-300">
                      <X size={12} />
                    </button>
                  </div>
                  {evolutions.map((evo) => {
                    const evoPokemon = pokemonMap.get(evo.speciesId);
                    const sprite = evoPokemon ? getGenSprite(evoPokemon, activeGeneration) : null;
                    return (
                      <button
                        key={evo.speciesId}
                        onClick={() => handleEvolve(evo.speciesId)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-700 text-left text-xs text-gray-200 transition-colors"
                      >
                        {sprite && <img src={sprite} alt={evo.displayName} className="w-8 h-8 object-contain pixelated flex-shrink-0" />}
                        <div>
                          <div className="font-medium">{evo.displayName}</div>
                          <div className="text-gray-500">{evo.details}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Showdown export */}
        <button
          onClick={copyToShowdown}
          title="Copy to Pokémon Showdown"
          className={`flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1.5 rounded border text-xs transition-colors ${
            copyState === "copied"
              ? "bg-emerald-800 border-emerald-600 text-emerald-300"
              : copyState === "failed"
              ? "bg-red-900/60 border-red-700 text-red-300"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
          }`}
        >
          <ClipboardCopy size={13} />
          {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Couldn't copy" : "Showdown"}
        </button>
      </div>

      <Accordion title="Stats">
        <StatBlock
          slot={slot}
          pokemon={pokemon}
          activeGeneration={activeGeneration}
          onUpdate={update}
        />
      </Accordion>

      <Accordion title="Moves" defaultOpen={!compact}>
        <MoveGrid
          slot={slot}
          pokemonId={pokemon.id}
          activeGeneration={activeGeneration}
          onUpdate={update}
        />
      </Accordion>

      <Accordion title="Egg move finder" defaultOpen={false}>
        <EggMoveFinder
          pokemon={pokemon}
          allPokemon={allPokemon}
          activeGeneration={activeGeneration}
          versionGroup={versionGroupsFor(activeGeneration).some((vg) => vg.id === slot.selectedVersionGroup)
            ? slot.selectedVersionGroup
            : versionGroupsFor(activeGeneration)[0].id}
        />
      </Accordion>

      <Accordion title="IV Checker">
        <IvSection slot={slot} pokemon={pokemon} onUpdate={update} />
      </Accordion>

      <Accordion title="EV Tracker">
        <EvTracker
          slot={slot}
          allPokemon={allPokemon}
          activeGeneration={activeGeneration}
          onUpdate={update}
        />
      </Accordion>
    </div>
  );
}
