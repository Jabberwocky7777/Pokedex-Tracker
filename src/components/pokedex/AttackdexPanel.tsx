import type { Pokemon } from "../../types";
import type { VersionGroup } from "../../lib/move-fetch";
import { useAttackdex } from "../../hooks/useAttackdex";
import { getMachines, GEN3_SPLIT_VERSION_GROUPS } from "./pokedexHelpers";
import { GEN3_TM_LOCATIONS, GEN4_TM_LOCATIONS } from "../../lib/tm-locations";
import TypeBadge from "../shared/TypeBadge";
import { CategoryBadge } from "./CategoryBadge";
import { SectionHeading } from "./SectionHeading";
import { LearnerGrid } from "./LearnerGrid";
import { GEN3_VERSION_GROUPS, GEN4_VERSION_GROUPS } from "../../lib/move-fetch";

const VG_TO_GAMES: Record<VersionGroup, string[]> = {
  "ruby-sapphire":        ["ruby", "sapphire"],
  "emerald":              ["emerald"],
  "firered-leafgreen":    ["firered", "leafgreen"],
  "diamond-pearl":        ["diamond", "pearl"],
  "platinum":             ["platinum"],
  "heartgold-soulsilver": ["heartgold", "soulsilver"],
};

interface Props {
  slug: string;
  allPokemon: Pokemon[];
  activeGeneration: number;
  versionGroup: VersionGroup;
  onVersionGroupChange: (vg: VersionGroup) => void;
  onSelectPokemon: (id: number) => void;
}

export function AttackdexPanel({
  slug,
  allPokemon,
  activeGeneration,
  versionGroup,
  onVersionGroupChange,
  onSelectPokemon,
}: Props) {
  const activeVersionGroups = activeGeneration === 4 ? GEN4_VERSION_GROUPS : GEN3_VERSION_GROUPS;
  const { detail, learners, loading, learnersLoading, error } = useAttackdex(
    slug,
    allPokemon,
    activeGeneration
  );

  const isGen3Vg = (GEN3_SPLIT_VERSION_GROUPS as Set<string>).has(versionGroup);
  const machines = getMachines(versionGroup);
  const machineLabel = detail ? machines[detail.name] ?? null : null;
  const locationMap = isGen3Vg ? GEN3_TM_LOCATIONS : GEN4_TM_LOCATIONS;
  const tmLocation = detail ? locationMap[detail.name]?.[versionGroup] ?? null : null;

  const vgLearners = learners.get(versionGroup) ?? [];
  const levelUpLearners = vgLearners.filter((e) => e.method === "level-up");
  const machineLearners = vgLearners.filter((e) => e.method === "machine");
  const eggLearners = vgLearners.filter((e) => e.method === "egg");
  const tutorLearners = vgLearners.filter((e) => e.method === "tutor");

  // Flavor text: find best match for the active version group
  const flavorText = detail?.flavorTextEntries.find(
    (e) => VG_TO_GAMES[versionGroup]?.some((g) => e.versionGroup.includes(g))
  )?.text ?? detail?.flavorTextEntries[0]?.text ?? null;

  // Category: use gen3 split for Gen 3 version groups
  const displayCategory = detail
    ? isGen3Vg ? detail.gen3Category : detail.category
    : null;

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-5 flex items-center gap-3 text-gray-500 text-sm">
        <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading move data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-5 text-sm text-red-400">
        Failed to load move: {error}
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-bold text-white">{detail.displayName}</h3>
            <TypeBadge type={detail.type} />
            {displayCategory && <CategoryBadge cat={displayCategory} />}
            {machineLabel && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-700 text-gray-200">
                {machineLabel}
              </span>
            )}
          </div>
          {/* Version group tabs */}
          <div className="flex gap-1 flex-wrap">
            {activeVersionGroups.map((vg) => (
              <button
                key={vg.id}
                onClick={() => onVersionGroupChange(vg.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  versionGroup === vg.id
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                }`}
              >
                {vg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stat strip */}
        <div className="flex gap-3 flex-wrap">
          <StatPill label="Power" value={detail.power != null ? String(detail.power) : "—"} />
          <StatPill label="Accuracy" value={detail.accuracy != null ? `${detail.accuracy}%` : "—"} />
          <StatPill label="PP" value={String(detail.pp)} />
          {detail.contestType && (
            <StatPill label="Contest" value={capitalize(detail.contestType)} />
          )}
        </div>
      </div>

      {/* Effect */}
      {detail.shortEffect && (
        <div className="flex flex-col gap-1">
          <SectionHeading>Effect</SectionHeading>
          <p className="text-sm text-gray-300 leading-relaxed">{detail.shortEffect}</p>
          {detail.effect && detail.effect !== detail.shortEffect && (
            <details className="mt-1">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">Full description</summary>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{detail.effect}</p>
            </details>
          )}
        </div>
      )}

      {/* In-game description */}
      {flavorText && (
        <div className="flex flex-col gap-1">
          <SectionHeading>In-Game Description</SectionHeading>
          <p className="text-sm text-gray-400 italic leading-relaxed">{flavorText}</p>
        </div>
      )}

      {/* TM/HM location */}
      {machineLabel && (
        <div className="flex flex-col gap-1">
          <SectionHeading>{machineLabel} Location</SectionHeading>
          {tmLocation ? (
            <p className="text-sm text-gray-300">{tmLocation}</p>
          ) : (
            <p className="text-sm text-gray-600">Location data not available for this version.</p>
          )}
        </div>
      )}

      {/* Learner sections */}
      {levelUpLearners.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionHeading>Level-Up</SectionHeading>
          <LearnerGrid
            learners={levelUpLearners}
            allPokemon={allPokemon}
            activeGeneration={activeGeneration}
            learnersLoading={learnersLoading}
            onSelectPokemon={onSelectPokemon}
          />
        </div>
      )}

      {machineLearners.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionHeading>TM / HM</SectionHeading>
          <LearnerGrid
            learners={machineLearners}
            allPokemon={allPokemon}
            activeGeneration={activeGeneration}
            machineLabel={machineLabel ?? undefined}
            learnersLoading={learnersLoading}
            onSelectPokemon={onSelectPokemon}
          />
        </div>
      )}

      {eggLearners.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionHeading>Egg Move</SectionHeading>
          <LearnerGrid
            learners={eggLearners}
            allPokemon={allPokemon}
            activeGeneration={activeGeneration}
            learnersLoading={learnersLoading}
            onSelectPokemon={onSelectPokemon}
          />
        </div>
      )}

      {tutorLearners.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionHeading>Move Tutor</SectionHeading>
          <LearnerGrid
            learners={tutorLearners}
            allPokemon={allPokemon}
            activeGeneration={activeGeneration}
            learnersLoading={learnersLoading}
            onSelectPokemon={onSelectPokemon}
          />
        </div>
      )}

      {/* Show spinner if loading but no learner sections yet */}
      {learnersLoading && levelUpLearners.length === 0 && machineLearners.length === 0 &&
       eggLearners.length === 0 && tutorLearners.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading learner data…
        </div>
      )}

      {/* No learners after load */}
      {!learnersLoading && vgLearners.length === 0 && (
        <p className="text-sm text-gray-600">No Pokémon learn this move in this version.</p>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-mono font-semibold text-gray-200">{value}</span>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
