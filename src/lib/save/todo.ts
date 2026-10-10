/**
 * Living-dex to-do list: concrete, ordered steps that take the living-dex save
 * from where it is to complete, using every imported save.
 *
 * Works from the slim summaries; where the full save is on this device the
 * evolve steps also know about friendship, held items and moves.
 */
import type { GameVersion, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { planAcquisition, profileGames, sendSources } from "./acquire";
import { checkTowards, type EvolveCheck } from "./evolve";
import { allocatePending, analyzeProfile, breedingHints, homeSlot, reservedForOwnSlot, slotLabel } from "./living-dex";
import type { ParsedSave, ProfileMons, SaveMon, SlimMon } from "./types";

export type TodoKind = "swap" | "move" | "evolve" | "bring" | "catch" | "breed" | "spare";

export const TODO_SECTIONS: { kind: TodoKind; label: string; hint: string }[] = [
  { kind: "swap", label: "Swap", hint: "Two Pokémon sitting in each other's slots" },
  { kind: "move", label: "Move into place", hint: "Already in your living-dex save, just not in their slot" },
  { kind: "evolve", label: "Evolve", hint: "An earlier stage is waiting to become these" },
  { kind: "bring", label: "Bring over", hint: "You have these in another save" },
  { kind: "catch", label: "Catch", hint: "Still missing everywhere" },
  { kind: "breed", label: "Breed", hint: "Babies you can hatch from something you own" },
  { kind: "spare", label: "Spares", hint: "Not needed for the living dex — trade or release fodder" },
];

export interface TodoStep {
  /** Stable while the save doesn't change — used to remember check marks */
  id: string;
  kind: TodoKind;
  /** The species the step is about (the one that ends up placed, or the spare) */
  species: number;
  text: string;
  detail?: string;
  /** Steps are batched under this heading: a box, a source save, a game */
  group: string;
  /** Evolve steps: can be done right now */
  ready?: boolean;
  /** Catch steps: the location, for opening it in Routes */
  slug?: string;
  /** Sorts groups within a section (lower first); groups with the same value sort by name */
  order?: number;
}

export interface TodoList {
  /** The living-dex profile the list is for, or null when none is set */
  living: ProfileMons | null;
  steps: TodoStep[];
  placed: number;
  /** Species that have a slot in this save */
  total: number;
  complete: boolean;
}

export interface TodoOptions {
  /** Every Pokémon of the saves' generation */
  pokemon: Pokemon[];
  genGames: readonly GameVersion[];
  maxSpecies: number;
  /** Fully parsed saves by profile id, where this device has them */
  fullSaves?: Record<string, ParsedSave>;
}

export function findFull(fullSaves: Record<string, ParsedSave> | undefined, profileId: string, mon: SlimMon): SaveMon | undefined {
  return fullSaves?.[profileId]?.mons.find((m) => m.box === mon.box && m.slot === mon.slot && m.species === mon.species);
}

const KIND_ORDER = TODO_SECTIONS.map((s) => s.kind);

export function buildTodo(profiles: ProfileMons[], opts: TodoOptions): TodoList {
  const { pokemon, genGames, maxSpecies, fullSaves } = opts;
  const living = profiles.find((p) => p.profile.role === "living-dex") ?? null;
  if (!living) return { living: null, steps: [], placed: 0, total: 0, complete: false };

  const dex = new Map(pokemon.map((p) => [p.id, p]));
  const nameOf = (id: number) => dex.get(id)?.displayName ?? `#${id}`;
  const where = (p: ProfileMons, m: { box: number; slot: number }) => slotLabel(p.boxNames, m.box, m.slot);
  const boxOf = (p: ProfileMons, box: number) => (box < 0 ? "Party" : p.boxNames[box] || `Box ${box + 1}`);

  const a = analyzeProfile(living, dex, maxSpecies);
  const others = profiles.filter((p) => p !== living);
  const allocation = allocatePending(profiles, dex, maxSpecies);
  const breeding = breedingHints(allocation.owned, dex, maxSpecies);
  const elsewhere = sendSources(others);
  const placeholderMons = new Set(a.placeholders.values());
  const movers = reservedForOwnSlot(a);

  const steps: TodoStep[] = [];
  const used = new Set<SlimMon>();
  const swapped = new Set<number>();
  const toAcquire: number[] = [];

  for (const [species, slot] of a.slots) {
    if (slot.state === "placed" || swapped.has(species)) continue;

    // 1. A copy is already in the living-dex save, just somewhere else
    const copy = movers.get(species);
    if (copy) {
      used.add(copy);
      const occupant = slot.occupant;
      const occupantHome = occupant && !occupant.isEgg ? homeSlot(occupant.species, living.profile.startBox) : null;
      if (occupant && occupantHome && occupantHome.box === copy.box && occupantHome.slot === copy.slot) {
        // They are in each other's slots: one swap fixes both
        used.add(occupant);
        swapped.add(occupant.species);
        steps.push({
          id: `swap:${species}:${occupant.species}`, kind: "swap", species, group: boxOf(living, copy.box),
          text: `Swap ${nameOf(species)} (${where(living, copy)}) with ${nameOf(occupant.species)} (${where(living, slot)})`,
        });
      } else {
        steps.push({
          id: `move:${species}:${copy.box}:${copy.slot}`, kind: "move", species, group: boxOf(living, copy.box),
          text: `Move ${nameOf(species)}: ${where(living, copy)} → ${where(living, slot)}`,
          detail: occupant ? `It swaps places with the ${occupant.isEgg ? "Egg" : nameOf(occupant.species)} there` : undefined,
        });
      }
      continue;
    }

    // 2. Another save has one
    const source = elsewhere.get(species);
    if (source) {
      steps.push({
        id: `bring:${species}:${source.profileId}`, kind: "bring", species, group: source.label,
        text: `Bring ${nameOf(species)} over from ${source.label} (${slotLabel(source.boxNames, source.mon.box, source.mon.slot)})`,
        detail: `It goes in ${where(living, slot)}`,
      });
      continue;
    }

    // 3. An earlier stage is waiting to evolve into it
    const reason = allocation.pending.get(species);
    if (reason) {
      const owner = profiles.find((p) => p.profile.id === reason.profileId) ?? living;
      used.add(reason.mon);
      const check: EvolveCheck | null = checkTowards(reason.mon, findFull(fullSaves, owner.profile.id, reason.mon), species, dex);
      const next = check && check.target !== species ? ` (next: ${nameOf(check.target)})` : "";
      steps.push({
        id: `evolve:${species}:${reason.mon.box}:${reason.mon.slot}`, kind: "evolve", species,
        group: owner === living ? boxOf(living, reason.mon.box) : owner.profile.label,
        ready: check?.status === "ready",
        text: `Evolve ${nameOf(reason.from)} (${where(owner, reason.mon)}) into ${nameOf(species)}${next}`,
        detail: check ? `${check.method} — ${check.text}` : undefined,
      });
      continue;
    }

    // 4. A baby that can be bred
    const parent = breeding.get(species);
    if (parent !== undefined) {
      steps.push({
        id: `breed:${species}`, kind: "breed", species, group: "Breed",
        text: `Breed ${nameOf(parent)} to get ${nameOf(species)}`,
      });
      continue;
    }
    toAcquire.push(species);
  }

  // 5. Everything else has to be caught (or its earlier stage does)
  const yourGames = [...new Set(profiles.flatMap((p) => profileGames(p.profile)))].filter((g) => genGames.includes(g));
  const plan = planAcquisition(toAcquire, { pokemon, genGames, yourGames });
  for (const species of toAcquire) {
    const how = plan.get(species)!;
    if (how.kind === "catch") {
      const { spot } = how;
      const level = spot.minLevel === spot.maxLevel ? `Lv ${spot.minLevel}` : `Lv ${spot.minLevel}–${spot.maxLevel}`;
      const notes = [
        spot.exclusive ? `${GAME_LABELS[spot.game]} exclusive` : "",
        spot.inYourGames ? "" : "not in a game you've imported",
      ].filter(Boolean).join(" · ");
      steps.push({
        id: `catch:${species}`, kind: "catch", species, group: GAME_LABELS[spot.game], slug: spot.slug,
        order: spot.inYourGames ? 0 : 1,
        text: `Catch ${nameOf(species)} in ${GAME_LABELS[spot.game]}: ${spot.location}, ${level}`,
        detail: notes || undefined,
      });
    } else if (how.kind === "evolve") {
      steps.push({
        id: `catch:${species}`, kind: "catch", species, group: "Evolve from something you catch", order: 2,
        text: `Get ${nameOf(species)} by evolving ${nameOf(how.from)}`,
        detail: [
          allocation.owned.has(how.from) ? `You need another ${nameOf(how.from)} for this` : `Get ${nameOf(how.from)} first`,
          how.trade ? "it evolves by trade" : "",
        ].filter(Boolean).join(" — "),
      });
    } else {
      steps.push({
        id: `catch:${species}`, kind: "catch", species, group: "No wild encounter", order: 3,
        text: `${nameOf(species)}: no wild encounter in these games`,
        detail: "Event, gift, in-game trade or transfer only",
      });
    }
  }

  // 6. What's left over in the living-dex save isn't needed for anything
  for (const m of a.spares) {
    if (used.has(m) || placeholderMons.has(m)) continue;
    steps.push({
      id: `spare:${m.species}:${m.box}:${m.slot}`, kind: "spare", species: m.species, group: boxOf(living, m.box),
      text: `Spare ${nameOf(m.species)}: ${where(living, m)}`,
    });
  }

  steps.sort((x, y) =>
    KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind)
    || Number(y.ready ?? false) - Number(x.ready ?? false)
    || (x.order ?? 0) - (y.order ?? 0)
    || x.group.localeCompare(y.group, undefined, { numeric: true })
    || x.species - y.species);

  return { living, steps, placed: a.placed.size, total: a.slots.size, complete: a.slots.size > 0 && a.placed.size === a.slots.size };
}
