import { create } from "zustand";
import { safeStorage } from "../lib/safe-storage";
import { persist } from "zustand/middleware";

// gen → game → boxIndex → slotIndex (0–29) → pokemonId | null
type SlotsByGen = Record<number, Record<string, (number | null)[][]>>;

interface BoxSlotStore {
  slotsByGen: SlotsByGen;
  assignSlot(gen: number, game: string, box: number, slot: number, pokemonId: number): void;
  clearSlot(gen: number, game: string, box: number, slot: number): void;
  moveSlot(gen: number, game: string, fromBox: number, fromSlot: number, toBox: number, toSlot: number): void;
  setSlotsByGen(data: SlotsByGen): void;
}

function getOrInitBoxes(state: SlotsByGen, gen: number, game: string, numBoxes: number): (number | null)[][] {
  const genData = state[gen] ?? {};
  const gameBoxes = genData[game] ?? [];
  if (gameBoxes.length < numBoxes) {
    const filled = [...gameBoxes];
    while (filled.length < numBoxes) filled.push(Array(30).fill(null));
    return filled;
  }
  return gameBoxes;
}

export const useBoxSlotStore = create<BoxSlotStore>()(
  persist(
    (set) => ({
      slotsByGen: {},

      assignSlot: (gen, game, box, slot, pokemonId) =>
        set((state) => {
          const boxes = getOrInitBoxes(state.slotsByGen, gen, game, box + 1).map((b) => [...b]);
          boxes[box][slot] = pokemonId;
          return {
            slotsByGen: {
              ...state.slotsByGen,
              [gen]: { ...(state.slotsByGen[gen] ?? {}), [game]: boxes },
            },
          };
        }),

      clearSlot: (gen, game, box, slot) =>
        set((state) => {
          const genData = state.slotsByGen[gen];
          if (!genData?.[game]) return state;
          const boxes = genData[game].map((b) => [...b]);
          if (!boxes[box]) return state;
          boxes[box][slot] = null;
          return {
            slotsByGen: {
              ...state.slotsByGen,
              [gen]: { ...genData, [game]: boxes },
            },
          };
        }),

      moveSlot: (gen, game, fromBox, fromSlot, toBox, toSlot) =>
        set((state) => {
          const genData = state.slotsByGen[gen];
          if (!genData?.[game]) return state;
          const boxes = genData[game].map((b) => [...b]);
          if (!boxes[fromBox] || !boxes[toBox]) return state;
          const moving = boxes[fromBox][fromSlot];
          const displaced = boxes[toBox][toSlot];
          boxes[toBox][toSlot] = moving;
          boxes[fromBox][fromSlot] = displaced;
          return {
            slotsByGen: {
              ...state.slotsByGen,
              [gen]: { ...genData, [game]: boxes },
            },
          };
        }),

      setSlotsByGen: (data) => set({ slotsByGen: data }),
    }),
    {
      name: "box-slots-v1",
      storage: safeStorage,
      partialize: (state) => ({ slotsByGen: state.slotsByGen }),
    },
  ),
);
