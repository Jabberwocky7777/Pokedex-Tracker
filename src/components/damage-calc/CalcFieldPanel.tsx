import { useBattleCalcStore } from "../../store/useBattleCalcStore";
import { useShallow } from "zustand/react/shallow";
import type { WeatherCondition } from "../../types/battleTower";
import SegmentedControl, { type SegmentOption } from "../shared/SegmentedControl";
import { Sun, CloudRain, Wind, Snowflake } from "lucide-react";

const WEATHER_OPTIONS: SegmentOption<WeatherCondition>[] = [
  { value: "none", label: "None" },
  { value: "sun",  label: "Sun",  icon: <Sun size={13} aria-hidden="true" /> },
  { value: "rain", label: "Rain", icon: <CloudRain size={13} aria-hidden="true" /> },
  { value: "sand", label: "Sand", icon: <Wind size={13} aria-hidden="true" /> },
  { value: "hail", label: "Hail", icon: <Snowflake size={13} aria-hidden="true" /> },
];

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded transition-colors ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function SpikesBtn({
  value,
  current,
  onClick,
}: {
  value: 0 | 1 | 2 | 3;
  current: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 text-xs rounded transition-colors ${
        current === value
          ? "bg-indigo-600 text-white"
          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
      }`}
    >
      {value}
    </button>
  );
}

export default function CalcFieldPanel() {
  const store = useBattleCalcStore(useShallow((s) => s));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 text-center">Field</h3>

      {/* Battle format */}
      <div>
        <div className="text-xs text-gray-500 mb-1.5">Format</div>
        <SegmentedControl
          ariaLabel="Battle format"
          size="sm"
          value={store.isSingles ? "singles" : "doubles"}
          onChange={(v) => store.setIsSingles(v === "singles")}
          options={[{ value: "singles", label: "Singles" }, { value: "doubles", label: "Doubles" }]}
        />
      </div>

      {/* Weather */}
      <div>
        <div className="text-xs text-gray-500 mb-1.5">Weather</div>
        <SegmentedControl ariaLabel="Weather" size="sm" wrap value={store.weather} onChange={store.setWeather} options={WEATHER_OPTIONS} />
      </div>

      {/* Side 1 hazards */}
      <div>
        <div className="text-xs text-gray-500 mb-1.5 font-semibold">Pokémon 1's Side</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Stealth Rock</span>
            <ToggleBtn active={store.stealthRock1} onClick={() => store.setStealthRock1(!store.stealthRock1)}>
              {store.stealthRock1 ? "On" : "Off"}
            </ToggleBtn>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Spikes</span>
            <div className="flex gap-1">
              {([0, 1, 2, 3] as const).map((n) => (
                <SpikesBtn key={n} value={n} current={store.spikes1} onClick={() => store.setSpikes1(n)} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Reflect</span>
            <ToggleBtn active={store.reflect1} onClick={() => store.setReflect1(!store.reflect1)}>
              {store.reflect1 ? "On" : "Off"}
            </ToggleBtn>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Light Screen</span>
            <ToggleBtn active={store.lightScreen1} onClick={() => store.setLightScreen1(!store.lightScreen1)}>
              {store.lightScreen1 ? "On" : "Off"}
            </ToggleBtn>
          </div>
        </div>
      </div>

      {/* Side 2 hazards */}
      <div>
        <div className="text-xs text-gray-500 mb-1.5 font-semibold">Pokémon 2's Side</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Stealth Rock</span>
            <ToggleBtn active={store.stealthRock2} onClick={() => store.setStealthRock2(!store.stealthRock2)}>
              {store.stealthRock2 ? "On" : "Off"}
            </ToggleBtn>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Spikes</span>
            <div className="flex gap-1">
              {([0, 1, 2, 3] as const).map((n) => (
                <SpikesBtn key={n} value={n} current={store.spikes2} onClick={() => store.setSpikes2(n)} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Reflect</span>
            <ToggleBtn active={store.reflect2} onClick={() => store.setReflect2(!store.reflect2)}>
              {store.reflect2 ? "On" : "Off"}
            </ToggleBtn>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Light Screen</span>
            <ToggleBtn active={store.lightScreen2} onClick={() => store.setLightScreen2(!store.lightScreen2)}>
              {store.lightScreen2 ? "On" : "Off"}
            </ToggleBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
