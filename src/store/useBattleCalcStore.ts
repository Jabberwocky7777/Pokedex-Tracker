import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalcPokemon, WeatherCondition } from "../types/battleTower";

interface BattleCalcStore {
  slot1: CalcPokemon | null;
  slot2: CalcPokemon | null;
  weather: WeatherCondition;
  isSingles: boolean;
  stealthRock1: boolean;
  stealthRock2: boolean;
  spikes1: 0 | 1 | 2 | 3;
  spikes2: 0 | 1 | 2 | 3;
  reflect1: boolean;
  reflect2: boolean;
  lightScreen1: boolean;
  lightScreen2: boolean;

  setSlot1: (p: CalcPokemon | null) => void;
  setSlot2: (p: CalcPokemon | null) => void;
  setWeather: (w: WeatherCondition) => void;
  setIsSingles: (v: boolean) => void;
  setStealthRock1: (v: boolean) => void;
  setStealthRock2: (v: boolean) => void;
  setSpikes1: (v: 0 | 1 | 2 | 3) => void;
  setSpikes2: (v: 0 | 1 | 2 | 3) => void;
  setReflect1: (v: boolean) => void;
  setReflect2: (v: boolean) => void;
  setLightScreen1: (v: boolean) => void;
  setLightScreen2: (v: boolean) => void;
}

export const useBattleCalcStore = create<BattleCalcStore>()(
  persist(
    (set) => ({
      slot1: null,
      slot2: null,
      weather: "none",
      isSingles: true,
      stealthRock1: false,
      stealthRock2: false,
      spikes1: 0,
      spikes2: 0,
      reflect1: false,
      reflect2: false,
      lightScreen1: false,
      lightScreen2: false,

      setSlot1: (p) => set({ slot1: p }),
      setSlot2: (p) => set({ slot2: p }),
      setWeather: (w) => set({ weather: w }),
      setIsSingles: (v) => set({ isSingles: v }),
      setStealthRock1: (v) => set({ stealthRock1: v }),
      setStealthRock2: (v) => set({ stealthRock2: v }),
      setSpikes1: (v) => set({ spikes1: v }),
      setSpikes2: (v) => set({ spikes2: v }),
      setReflect1: (v) => set({ reflect1: v }),
      setReflect2: (v) => set({ reflect2: v }),
      setLightScreen1: (v) => set({ lightScreen1: v }),
      setLightScreen2: (v) => set({ lightScreen2: v }),
    }),
    { name: "battle-calc-v1" },
  ),
);
