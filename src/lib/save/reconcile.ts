/**
 * Turns imported saves into a list of proposed tracker changes. Nothing here
 * touches the stores — the review screen shows the plan and applies only what
 * the user leaves ticked.
 *
 * The plan is always made against every imported profile of the generation,
 * so "not in this save" really means "not in any save I've imported".
 */
import type { DexField, GenSnapshot } from "../../store/useDexStore";
import { allocatePending, analyzeProfile, breedingHints, type Allocation } from "./living-dex";
import { MAX_SPECIES_GEN4, type ProfileMons, type SpeciesMap } from "./types";

export interface PlannedChange {
  field: DexField;
  id: number;
  /** true = add the mark, false = remove it */
  value: boolean;
  /** Whether the change starts ticked in the review */
  recommended: boolean;
  reason: string;
}

export type StaleStatus = "older" | "same" | null;

export interface ImportPlan {
  changes: PlannedChange[];
  /** The incoming dump compared with the one already stored for that profile */
  stale: StaleStatus;
  /** More than MASS_REMOVAL_LIMIT removals were recommended, so all of them were unticked */
  massRemoval: boolean;
  /** Missing babies that could be bred from something owned (advice, not a change) */
  breeding: { baby: number; parent: number }[];
  allocation: Allocation;
}

export interface PlanOptions {
  dex: SpeciesMap;
  /** On: ✦ comes only from the Pokémon in the living-dex slot. Off: any shiny copy counts. */
  shinyLivingDex?: boolean;
  /** Save counter of the dump being imported, and of the one previously stored for the same profile */
  incomingSaveCount?: number;
  previousSaveCount?: number;
  maxSpecies?: number;
}

export const MASS_REMOVAL_LIMIT = 10;

export type ChangeGroup = `${DexField}-${"add" | "remove"}`;

/** Review sections, in display order. */
export const CHANGE_GROUPS: { id: ChangeGroup; label: string }[] = [
  { id: "placed-add", label: "★ Placed" },
  { id: "caught-add", label: "Caught" },
  { id: "shiny-add", label: "✦ Shiny" },
  { id: "pending-add", label: "Needs to evolve" },
  { id: "placed-remove", label: "No longer placed" },
  { id: "pending-remove", label: "No longer needs to evolve" },
  { id: "caught-remove", label: "Not in any save" },
  { id: "shiny-remove", label: "Not shiny" },
];

export const groupOf = (c: Pick<PlannedChange, "field" | "value">): ChangeGroup =>
  `${c.field}-${c.value ? "add" : "remove"}`;

export const changeKey = (c: Pick<PlannedChange, "field" | "id">): string => `${c.field}:${c.id}`;

function listLabels(labels: string[]): string {
  if (labels.length <= 2) return labels.join(" and ");
  return `${labels[0]} and ${labels.length - 1} other saves`;
}

export function planImport(profiles: ProfileMons[], currentMarks: GenSnapshot, options: PlanOptions): ImportPlan {
  const { dex, shinyLivingDex = false, incomingSaveCount, previousSaveCount } = options;
  const maxSpecies = options.maxSpecies ?? MAX_SPECIES_GEN4;
  const nameOf = (id: number) => dex.get(id)?.displayName ?? `#${id}`;

  const allocation = allocatePending(profiles, dex, maxSpecies);
  const analyses = profiles.map((p) => ({ p, a: analyzeProfile(p, dex, maxSpecies) }));
  const livingDexLabel = profiles.find((p) => p.profile.role === "living-dex")?.profile.label ?? "your living dex";
  const labelsWhere = (pick: (a: (typeof analyses)[number]["a"]) => ReadonlySet<number>, id: number) =>
    listLabels(analyses.filter(({ a }) => pick(a).has(id)).map(({ p }) => p.profile.label));

  const marked = {
    caught: new Set(currentMarks.caught),
    pending: new Set(currentMarks.pending),
    shiny: new Set(currentMarks.shiny),
    placed: new Set(currentMarks.placed ?? []),
  };

  const changes: PlannedChange[] = [];
  const add = (field: DexField, id: number, value: boolean, recommended: boolean, reason: string) =>
    changes.push({ field, id, value, recommended, reason });

  // With "Shiny living dex" on, only the Pokémon sitting in the slot counts
  const shinySource = shinyLivingDex ? allocation.shinyPlaced : allocation.shinyOwned;
  const planShiny = !shinyLivingDex || allocation.hasLivingDex;

  for (let id = 1; id <= maxSpecies; id++) {
    const owned = allocation.owned.has(id);

    // placed — only a living-dex save can say anything about placement
    if (allocation.hasLivingDex) {
      const placed = allocation.placed.has(id);
      if (placed && !marked.placed.has(id)) add("placed", id, true, true, `In its slot in ${livingDexLabel}`);
      if (!placed && marked.placed.has(id)) add("placed", id, false, true, `Not in its slot in ${livingDexLabel} any more`);
    }

    // caught
    if (owned && !marked.caught.has(id)) add("caught", id, true, true, `In ${labelsWhere((a) => a.owned, id)}`);
    if (!owned && marked.caught.has(id)) {
      add("caught", id, false, false, "Not in any imported save — it may be on a cartridge you haven't imported");
    }

    // shiny
    if (planShiny) {
      const shiny = shinySource.has(id);
      if (shiny && !marked.shiny.has(id)) {
        add("shiny", id, true, true, shinyLivingDex
          ? `The one in its ${livingDexLabel} slot is shiny`
          : `Shiny in ${labelsWhere((a) => a.shinyOwned, id)}`);
      }
      if (!shiny && marked.shiny.has(id)) {
        add("shiny", id, false, false, shinyLivingDex
          ? "The one in its living-dex slot isn't shiny"
          : "No shiny copy in any imported save");
      }
    }

    // pending
    const reason = allocation.pending.get(id);
    if (reason && !marked.pending.has(id)) {
      const others = reason.alternatives.length > 0
        ? ` (it could also become ${reason.alternatives.map(nameOf).join(", ")})`
        : "";
      add("pending", id, true, true, reason.kind === "placeholder"
        ? `${nameOf(reason.from)} is holding its slot`
        : `A spare ${nameOf(reason.from)} can evolve into it${others}`);
    }
    if (!reason && marked.pending.has(id)) {
      if (owned) add("pending", id, false, true, "You have it now");
      else add("pending", id, false, false, "No earlier stage to evolve in any imported save");
    }
  }

  // ── Safety rules ──────────────────────────────────────────────────────────
  let stale: StaleStatus = null;
  if (incomingSaveCount !== undefined && previousSaveCount !== undefined) {
    if (incomingSaveCount < previousSaveCount) stale = "older";
    else if (incomingSaveCount === previousSaveCount) stale = "same";
  }
  const untickRemovals = () => {
    for (const c of changes) if (!c.value) c.recommended = false;
  };
  // An older dump knows less than the tracker already does — never let it remove marks by default
  if (stale === "older") untickRemovals();

  // A pile of removals is more likely a wrong file or wrong settings than real progress
  const massRemoval = changes.filter((c) => !c.value && c.recommended).length > MASS_REMOVAL_LIMIT;
  if (massRemoval) untickRemovals();

  const breeding = [...breedingHints(allocation.owned, dex, maxSpecies)]
    .map(([baby, parent]) => ({ baby, parent }))
    .sort((a, b) => a.baby - b.baby);

  return { changes, stale, massRemoval, breeding, allocation };
}
