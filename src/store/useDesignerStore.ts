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
  ivDataPoints: IvDataPoint[];
  confirmedIVs: Record<StatKey, number | null>;
  evAllocation: Record<StatKey, number>;
  vitaminEVs: Record<StatKey, number>;
  machobraceActive: boolean;
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
    ivDataPoints: [],
    confirmedIVs: nullStats() as Record<StatKey, number | null>,
    evAllocation: zeroStats(),
    vitaminEVs: zeroStats(),
    machobraceActive: false,
    pokerusActive: false,
    knockOutLog: [],
    routePresets: [],
  };
}

interface DesignerStore {
  slots: DesignerSlot[];
  activeSlotIndex: number | null;
  setActiveSlot: (index: number | null) => void;
  updateSlot: (index: number, patch: Partial<DesignerSlot>) => void;
  clearSlot: (index: number) => void;
  duplicateSlot: (fromIndex: number, toIndex: number) => void;
  setSlots: (slots: DesignerSlot[]) => void;
}

const EMPTY_SLOTS = Array.from({ length: 30 }, (_, i) => emptySlot(i));

export const useDesignerStore = create<DesignerStore>()(
  persist(
    (set) => ({
      slots: EMPTY_SLOTS,
      activeSlotIndex: null,

      setActiveSlot: (index) => set({ activeSlotIndex: index }),

      updateSlot: (index, patch) =>
        set((state) => {
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

      duplicateSlot: (fromIndex, toIndex) =>
        set((state) => {
          const slots = [...state.slots];
          slots[toIndex] = { ...slots[fromIndex], slotIndex: toIndex };
          return { slots };
        }),

      setSlots: (slots) => set({ slots }),
    }),
    {
      name: "designer-v1",
      partialize: (state) => ({ slots: state.slots, activeSlotIndex: state.activeSlotIndex }),
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current>;
        // Deep-merge each slot so new fields added to emptySlot() get their defaults
        const rawSlots = p.slots ?? current.slots;
        const padded = Array.from({ length: 30 }, (_, i) => ({
          ...emptySlot(i),
          ...(rawSlots[i] ?? {}),
        }));
        return { ...current, ...p, slots: padded };
      },
    }
  )
);

export { emptySlot };
