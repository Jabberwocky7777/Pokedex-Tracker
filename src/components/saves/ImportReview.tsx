import { useEffect, useMemo, useRef, useState } from "react";
import type { Pokemon } from "../../types";
import { useDexStore } from "../../store/useDexStore";
import { useSaveStore } from "../../store/useSaveStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { applyImportWithUndo } from "../../lib/dex-actions";
import { getGenSprite } from "../../lib/pokemon-display";
import { FAMILY_LABELS, UNVERIFIED_FAMILIES } from "../../lib/save/gen4";
import {
  CHANGE_GROUPS, MASS_REMOVAL_LIMIT, changeKey, groupOf, planImport,
  type ChangeGroup, type ImportPlan, type PlannedChange,
} from "../../lib/save/reconcile";
import { genConfigOf, type ProfileMons } from "../../lib/save/types";
import { summarizeEntry, type HistoryEntry } from "../../lib/save/history";
import { HistoryDetails } from "./HistoryPanel";

export interface ReviewRequest {
  profileId: string;
  /** Set when the review follows a fresh import, to compare against the previous dump */
  incomingSaveCount?: number;
  previousSaveCount?: number;
  previousImportedAt?: number;
  /** What changed in the save since the previous import (fresh imports only) */
  since?: HistoryEntry;
  /** Parser warnings (unreadable slots, stale boxes) */
  warnings: string[];
}

interface Props {
  request: ReviewRequest;
  profiles: ProfileMons[];
  pokemonMap: Map<number, Pokemon>;
  onClose: () => void;
}

const formatDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function Banner({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "warn" ? "alert" : "note"}
      className={`px-3 py-2.5 rounded-lg border text-sm ${
        tone === "warn" ? "bg-amber-500/10 border-amber-500/40 text-amber-100" : "bg-gray-800/60 border-gray-700 text-gray-300"
      }`}
    >
      {children}
    </div>
  );
}

/** Checkbox that can also show "some but not all". */
function TriStateCheckbox({ state, onChange, label }: { state: "all" | "some" | "none"; onChange: (on: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={state === "all"}
      onChange={(e) => onChange(e.target.checked)}
      className="w-5 h-5 accent-indigo-500 cursor-pointer flex-shrink-0"
    />
  );
}

export default function ImportReview({ request, profiles, pokemonMap, onClose }: Props) {
  const shinyLivingDex = useSettingsStore((s) => s.shinyLivingDex);
  const profile = profiles.find((p) => p.profile.id === request.profileId);
  // Marks go to the tracker generation the save belongs to, planned with the other saves of that generation
  const gen = profile ? genConfigOf(profile.profile.family).gen : 4;

  // The plan is made once, against the marks as they are when the review opens
  const plan = useMemo<ImportPlan>(
    () =>
      planImport(profiles.filter((p) => genConfigOf(p.profile.family).gen === gen), useDexStore.getState().getGenSnapshot(gen), {
        dex: pokemonMap,
        shinyLivingDex,
        incomingSaveCount: request.incomingSaveCount,
        previousSaveCount: request.previousSaveCount,
      }),
    [profiles, pokemonMap, shinyLivingDex, request, gen],
  );

  if (!profile) return null;
  return (
    <ReviewSheet
      // A new plan (e.g. after toggling a setting) starts from its own recommendations
      key={plan.changes.map((c) => `${changeKey(c)}${c.value ? "+" : "-"}${c.recommended ? 1 : 0}`).join(",")}
      plan={plan}
      gen={gen}
      request={request}
      profile={profile}
      pokemonMap={pokemonMap}
      onClose={onClose}
    />
  );
}

function ReviewSheet({ plan, gen, request, profile, pokemonMap, onClose }: {
  plan: ImportPlan;
  /** Tracker generation the changes apply to */
  gen: number;
  request: ReviewRequest;
  profile: ProfileMons;
  pokemonMap: Map<number, Pokemon>;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(() => new Set(plan.changes.filter((c) => c.recommended).map(changeKey)));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const { family, label } = profile.profile;
  const noticesSeen = useSettingsStore((s) => s.saveNoticesSeen);
  // Shown on the first import of a game family that hasn't been checked against a real save
  const [showFamilyNotice] = useState(() => UNVERIFIED_FAMILIES.includes(family) && !noticesSeen.includes(family));

  const close = () => {
    if (showFamilyNotice) useSettingsStore.getState().markSaveNoticeSeen(family);
    onClose();
  };

  const groups = CHANGE_GROUPS
    .map((g) => ({ ...g, changes: plan.changes.filter((c) => groupOf(c) === g.id) }))
    .filter((g) => g.changes.length > 0);
  const selected = plan.changes.filter((c) => checked.has(changeKey(c)));

  const setMany = (changes: PlannedChange[], on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      for (const c of changes) {
        if (on) next.add(changeKey(c));
        else next.delete(changeKey(c));
      }
      return next;
    });
  const toggleExpanded = (id: ChangeGroup | "breeding") =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () => {
    const { before, applied } = applyImportWithUndo(gen, selected.map(({ field, id, value }) => ({ field, id, value })), label);
    // Kept on this device so the import can still be rolled back after the undo toast is gone
    useSaveStore.getState().setRevert(profile.profile.id, { at: Date.now(), gen, snapshot: before, changes: applied });
    const settings = useSettingsStore.getState();
    if (settings.activeGeneration !== gen) settings.setActiveGeneration(gen);
    close();
  };

  const nameOf = (id: number) => pokemonMap.get(id)?.displayName ?? `#${id}`;
  const spriteOf = (id: number) => {
    const p = pokemonMap.get(id);
    return p ? getGenSprite(p, gen) : "";
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Update tracker from ${label}`}
        className="fixed z-[60] bg-gray-900 border-gray-800 shadow-2xl flex flex-col
          inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border-t
          md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[36rem] md:max-h-[85vh] md:rounded-2xl md:border"
      >
        <div className="px-4 pt-4 pb-3 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "var(--theme-font-display)" }}>
            Update tracker from {label}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Nothing changes until you apply. Only ticked changes are made, and you can undo or revert afterwards.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {request.warnings.map((warning) => <Banner key={warning} tone="warn">{warning}</Banner>)}

          {request.since && !request.since.first && (
            <div className="px-3 py-2.5 rounded-lg border bg-emerald-500/10 border-emerald-500/30">
              <div className="text-xs text-emerald-300 font-medium uppercase tracking-wider">Since last import</div>
              <div className="text-sm text-gray-100 mt-0.5">{summarizeEntry(request.since, nameOf)}</div>
              <HistoryDetails entry={request.since} nameOf={nameOf} />
            </div>
          )}

          {plan.stale === "older" && (
            <Banner tone="warn">
              <strong>This dump is older than the one you imported
                {request.previousImportedAt ? ` on ${formatDate(request.previousImportedAt)}` : " before"}.</strong>{" "}
              Removals are unticked so an old save can&apos;t take marks away.
            </Banner>
          )}
          {plan.stale === "same" && (
            <Banner tone="info">You&apos;ve already imported this exact save. You can still review it again.</Banner>
          )}
          {plan.massRemoval && (
            <Banner tone="warn">
              This import would remove more than {MASS_REMOVAL_LIMIT} marks, which usually means the wrong file or the wrong
              &ldquo;Dex starts in&rdquo; box — so all removals are unticked. Tick them yourself if they are right.
            </Banner>
          )}
          {showFamilyNotice && (
            <Banner tone="info">
              {FAMILY_LABELS[family]} saves haven&apos;t been checked against a real cartridge yet. Please spot-check a few
              Pokémon in the box browser against your game before relying on this, and tell the developer if something
              looks wrong.
            </Banner>
          )}

          {groups.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">
              Your tracker already matches your imported saves — nothing to change.
            </div>
          )}

          {groups.map((group) => {
            const on = group.changes.filter((c) => checked.has(changeKey(c))).length;
            const state = on === 0 ? "none" : on === group.changes.length ? "all" : "some";
            const open = expanded.has(group.id);
            return (
              <section key={group.id} className="rounded-lg border border-gray-800 bg-gray-800/30">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <TriStateCheckbox state={state} onChange={(v) => setMany(group.changes, v)} label={`${group.label}: select all`} />
                  <button
                    onClick={() => toggleExpanded(group.id)}
                    aria-expanded={open}
                    className="flex-1 flex items-center justify-between gap-2 text-left min-h-[32px]"
                  >
                    <span className="text-sm font-medium text-gray-100">{group.label}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {on} of {group.changes.length} <span className="ml-1">{open ? "▾" : "▸"}</span>
                    </span>
                  </button>
                </div>
                {open && (
                  <ul className="border-t border-gray-800 divide-y divide-gray-800/70">
                    {group.changes.map((c) => (
                      <li key={changeKey(c)}>
                        <label className="flex items-center gap-3 px-3 py-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked.has(changeKey(c))}
                            onChange={(e) => setMany([c], e.target.checked)}
                            className="w-4 h-4 accent-indigo-500 flex-shrink-0"
                          />
                          <img src={spriteOf(c.id)} alt="" loading="lazy" className="w-8 h-8 object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />
                          <span className="min-w-0">
                            <span className="block text-sm text-gray-200">{nameOf(c.id)}</span>
                            <span className="block text-xs text-gray-500">{c.reason}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {/* Advice only — breeding never becomes a mark */}
          {plan.breeding.length > 0 && (
            <section className="rounded-lg border border-gray-800 bg-gray-800/30">
              <button
                onClick={() => toggleExpanded("breeding")}
                aria-expanded={expanded.has("breeding")}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="text-sm font-medium text-gray-100">♡ Needs breeding <span className="text-gray-500 font-normal">(for your information)</span></span>
                <span className="text-xs text-gray-400">{plan.breeding.length} {expanded.has("breeding") ? "▾" : "▸"}</span>
              </button>
              {expanded.has("breeding") && (
                <ul className="border-t border-gray-800 divide-y divide-gray-800/70">
                  {plan.breeding.map(({ baby, parent }) => (
                    <li key={baby} className="flex items-center gap-3 px-3 py-1.5">
                      <img src={spriteOf(baby)} alt="" loading="lazy" className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />
                      <span className="text-sm text-gray-300">Breed {nameOf(parent)} to get {nameOf(baby)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex gap-2 flex-shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <button
            onClick={close}
            className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
          >
            Not now
          </button>
          <button
            onClick={apply}
            disabled={selected.length === 0}
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply {selected.length} change{selected.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </>
  );
}
