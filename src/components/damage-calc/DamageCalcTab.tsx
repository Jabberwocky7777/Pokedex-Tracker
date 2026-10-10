import Header from "../layout/Header";
import type { Pokemon, MetaData } from "../../types";
import { useBattleCalcStore } from "../../store/useBattleCalcStore";
import CalcPokemonPanel from "./CalcPokemonPanel";
import CalcFieldPanel from "./CalcFieldPanel";
import { calcDamage } from "../../lib/damage-calc";
import { getAbilityModifiers } from "../../lib/damage-calc";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

export default function DamageCalcTab({ allPokemon }: Props) {
  const slot1 = useBattleCalcStore((s) => s.slot1);
  const slot2 = useBattleCalcStore((s) => s.slot2);
  const weather = useBattleCalcStore((s) => s.weather);
  const isSingles = useBattleCalcStore((s) => s.isSingles);
  const reflect1 = useBattleCalcStore((s) => s.reflect1);
  const reflect2 = useBattleCalcStore((s) => s.reflect2);
  const lightScreen1 = useBattleCalcStore((s) => s.lightScreen1);
  const lightScreen2 = useBattleCalcStore((s) => s.lightScreen2);
  const stealthRock1 = useBattleCalcStore((s) => s.stealthRock1);
  const stealthRock2 = useBattleCalcStore((s) => s.stealthRock2);
  const spikes1 = useBattleCalcStore((s) => s.spikes1);
  const spikes2 = useBattleCalcStore((s) => s.spikes2);

  // Determine if attacker is intimidated by defender's ability
  const slot1Intimidated = !!slot2 && getAbilityModifiers(slot2.ability).intimidatesOpponent;
  const slot2Intimidated = !!slot1 && getAbilityModifiers(slot1.ability).intimidatesOpponent;

  // Calculate damage for each move for both directions
  const calcMoveResults = (
    attacker: typeof slot1,
    defender: typeof slot2,
    attackerIntimidated: boolean,
    // Screens and entry hazards on the defender's side
    side: { reflect: boolean; lightScreen: boolean; stealthRock: boolean; spikes: 0 | 1 | 2 | 3 },
  ) => {
    if (!attacker || !defender) return [];
    return attacker.moves.map((move) =>
      calcDamage({
        attacker,
        defender,
        move,
        weather,
        attackerIntimidated,
        ...side,
        isSingles,
      })
    );
  };

  const results1to2 = calcMoveResults(slot1, slot2, slot1Intimidated, { reflect: reflect2, lightScreen: lightScreen2, stealthRock: stealthRock2, spikes: spikes2 });
  const results2to1 = calcMoveResults(slot2, slot1, slot2Intimidated, { reflect: reflect1, lightScreen: lightScreen1, stealthRock: stealthRock1, spikes: spikes1 });

  return (
    <div className="h-full flex flex-col bg-gray-950 overflow-hidden">
      <Header />

      <div className="flex-1 overflow-y-auto pb-[calc(52px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <div className="max-w-screen-xl mx-auto px-3 py-4">
          {/* One set of panels, placed by the grid: on a phone the two Pokémon sit
              side by side with the field below; from lg up the field is the
              middle column. */}
          <div className="grid grid-cols-2 gap-2 lg:gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_minmax(0,1fr)] items-start">
            <div className="min-w-0">
              <CalcPokemonPanel
                key={`slot1-${slot1?.species ?? "empty"}`}
                slot="slot1"
                allPokemon={allPokemon}
                moveResults={results1to2}
                defenderHp={slot2?.stats.hp ?? 0}
                label={<>Pokémon 1<span className="hidden lg:inline"> (Attacker)</span></>}
              />
            </div>
            <div className="col-span-2 order-last lg:col-span-1 lg:order-none">
              <CalcFieldPanel />
            </div>
            <div className="min-w-0">
              <CalcPokemonPanel
                key={`slot2-${slot2?.species ?? "empty"}`}
                slot="slot2"
                allPokemon={allPokemon}
                moveResults={results2to1}
                defenderHp={slot1?.stats.hp ?? 0}
                label={<>Pokémon 2<span className="hidden lg:inline"> (Opponent)</span></>}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
