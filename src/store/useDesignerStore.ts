import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StatKey } from "../lib/iv-calc";
import type { VersionGroup } from "../lib/move-fetch";

export interface IvDataPoint {
  level: number;
  stats: Record<StatKey, string>;
  evSnapshot?: Record<StatKey, number>;
}

export interface DesignerSlot {
  slotIndex: number;
  pokemonId: number | null;
  nickname: string;
  natureName: string;
  level: number;
  selectedVersionGroup: VersionGroup;
  selectedMoves: (string | null)[];
  ability: string | null;
  item: string | null;
  ivDataPoints: IvDataPoint[];
  confirmedIVs: Record<StatKey, number | null>;
  inferredIVs: Partial<Record<StatKey, number>>;
  evAllocation: Record<StatKey, number>;
  vitaminEVs: Record<StatKey, number>;
  machobraceActive: boolean;
  powerItemStat: StatKey | null;
  pokerusActive: boolean;
  knockOutLog: { speciesId: number; count: number }[];
  routePresets: { name: string; species: number[] }[];
}

function emptySlot(slotIndex: number): DesignerSlot {
  const zeroStats = (): Record<StatKey, number> => ({ hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spe: 0 });
  const nullStats = (): Record<StatKey, number | null> => ({ hp: null, atk: null, def: null, spAtk: null, spDef: null, spe: null });
  return {
    slotIndex,
    pokemonId: null,
    nickname: "",
    natureName: "Hardy",
    level: 50,
    selectedVersionGroup: "ruby-sapphire",
    selectedMoves: [null, null, null, null],
    ability: null,
    item: null,
    ivDataPoints: [],
    confirmedIVs: nullStats() as Record<StatKey, number | null>,
    inferredIVs: {},
    evAllocation: zeroStats(),
    vitaminEVs: zeroStats(),
    machobraceActive: false,
    powerItemStat: null,
    pokerusActive: false,
    knockOutLog: [],
    routePresets: [],
  };
}

const TOTAL_SLOTS = 90; // 3 boxes × 30 slots
const SLOTS_PER_BOX = 30;

interface DesignerStore {
  slots: DesignerSlot[];
  activeSlotIndex: number | null;
  /** Which box (0–2) is currently visible. Not persisted — resets to 0 on refresh. */
  activeBoxIndex: 0 | 1 | 2;
  setActiveSlot: (index: number | null) => void;
  setActiveBox: (box: 0 | 1 | 2) => void;
  updateSlot: (index: number, patch: Partial<DesignerSlot>) => void;
  clearSlot: (index: number) => void;
  /** Copy a slot's full contents into another slot, overwriting the target. */
  copySlotTo: (fromIndex: number, toIndex: number) => void;
  /** Change only the pokemonId, preserving all IVs/EVs/nature/moves. */
  evolveSlot: (index: number, newPokemonId: number) => void;
  setSlots: (slots: DesignerSlot[]) => void;
  /** Returns the 30 slots belonging to a given box (0–2). */
  getSlotsForBox: (box: 0 | 1 | 2) => DesignerSlot[];
}

const EMPTY_SLOTS = Array.from({ length: TOTAL_SLOTS }, (_, i) => emptySlot(i));

/**
 * Brings slots from anywhere — this device's storage, a sync payload, a backup
 * file — to the current shape: exactly TOTAL_SLOTS entries, every field present
 * (older data has 30 slots and lacks newer fields), slotIndex matching position.
 */
export function normalizeSlots(raw: unknown): DesignerSlot[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const saved = list[i];
    const fields = saved !== null && typeof saved === "object" && !Array.isArray(saved) ? (saved as Partial<DesignerSlot>) : {};
    return { ...emptySlot(i), ...fields, slotIndex: i };
  });
}

export const useDesignerStore = create<DesignerStore>()(
  persist(
    (set, get) => ({
      slots: EMPTY_SLOTS,
      activeSlotIndex: null,
      activeBoxIndex: 0,

      setActiveSlot: (index) => set({ activeSlotIndex: index }),
      setActiveBox: (box) => set({ activeBoxIndex: box }),

      getSlotsForBox: (box) => {
        const { slots } = get();
        return slots.slice(box * SLOTS_PER_BOX, (box + 1) * SLOTS_PER_BOX);
      },

      updateSlot: (index, patch) =>
        set((state) => {
          if (index < 0 || index >= state.slots.length) return state;
          const slots = [...state.slots];
          slots[index] = { ...slots[index], ...patch };
          return { slots };
        }),

      clearSlot: (index) =>
        set((state) => {
          const slots = [...state.slots];
          slots[index] = emptySlot(index);
          return { slots, activeSlotIndex: state.activeSlotIndex === index ? null : state.activeSlotIndex };
        }),

      copySlotTo: (fromIndex, toIndex) =>
        set((state) => {
          const slots = [...state.slots];
          const src = state.slots[fromIndex];
          slots[toIndex] = {
            ...src,
            slotIndex: toIndex,
            // Deep-clone nested objects so edits to the copy don't alias the original
            ivDataPoints: src.ivDataPoints.map((p) => ({ ...p, stats: { ...p.stats }, evSnapshot: p.evSnapshot ? { ...p.evSnapshot } : undefined })),
            confirmedIVs: { ...src.confirmedIVs },
            inferredIVs: { ...src.inferredIVs },
            evAllocation: { ...src.evAllocation },
            vitaminEVs: { ...src.vitaminEVs },
            selectedMoves: [...src.selectedMoves],
            knockOutLog: src.knockOutLog.map((e) => ({ ...e })),
            routePresets: src.routePresets.map((r) => ({ ...r, species: [...r.species] })),
          };
          return { slots };
        }),

      evolveSlot: (index, newPokemonId) =>
        set((state) => {
          const slots = [...state.slots];
          slots[index] = { ...slots[index], pokemonId: newPokemonId };
          return { slots };
        }),

      setSlots: (slots) => set({ slots: normalizeSlots(slots) }),
    }),
    {
      name: "designer-v2", // bumped from v1 because slot count changed 30→90
      // activeBoxIndex intentionally excluded — always resets to box 0 on load
      partialize: (state) => ({ slots: state.slots, activeSlotIndex: state.activeSlotIndex }),
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>;
        // Old saves (30 slots) are treated as Box 1; boxes 2–3 start empty
        return { ...current, ...p, slots: normalizeSlots(p.slots ?? current.slots), activeBoxIndex: 0 };
      },
    }
  )
);
