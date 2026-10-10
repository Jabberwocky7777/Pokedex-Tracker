import type { ParsedSave, ProfileMons, SaveMon, SaveProfile, SaveSummary, SlimMon, SummaryTuple } from "./types";

// A save's slim summary is what syncs to other devices: where each Pokémon
// sits and what it is, without IVs, moves or anything else from the file.

export function toSummary(save: { boxNames: string[]; mons: SlimMon[] }): SaveSummary {
  return {
    boxNames: [...save.boxNames],
    mons: save.mons.map((m): SummaryTuple => [m.box, m.slot, m.species, m.form, m.shiny ? 1 : 0, m.level, m.isEgg ? 1 : 0]),
  };
}

export function summaryMons(summary: SaveSummary | undefined): SlimMon[] {
  return (summary?.mons ?? []).map(([box, slot, species, form, shiny, level, isEgg]) => ({
    box, slot, species, form, shiny: shiny === 1, level, isEgg: isEgg === 1,
  }));
}

/** Pairs each profile with its Pokémon — the shape the living-dex and import-planning code works on. */
export function profileMons(profiles: SaveProfile[], summaries: Record<string, SaveSummary>): ProfileMons[] {
  return profiles.map((profile) => ({
    profile,
    boxNames: summaries[profile.id]?.boxNames ?? [],
    mons: summaryMons(summaries[profile.id]),
  }));
}

/** The full record behind a summary entry, when this device has the parsed save. */
export function findFull(fullSaves: Record<string, ParsedSave> | undefined, profileId: string, mon: SlimMon): SaveMon | undefined {
  return fullSaves?.[profileId]?.mons.find((m) => m.box === mon.box && m.slot === mon.slot && m.species === mon.species);
}
