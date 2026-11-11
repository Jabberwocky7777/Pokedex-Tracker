import { beforeEach, describe, expect, it } from "vitest";
import { mergeEntries, pruneTombstones, restoreEntries, TOMBSTONE_MAX_AGE_MS, type Entries } from "../entries";
import { mergePayload } from "../sync-merge";
import { buildPayload } from "../sync";
import { useNotesStore, type PokemonNote } from "../../store/useNotesStore";
import { useJournalStore } from "../../store/useJournalStore";
import type { BackupData } from "../backup";

const DAY = 24 * 60 * 60 * 1000;

const payload = (over: Partial<BackupData> = {}): BackupData => ({
  version: 2,
  exportedAt: "2026-01-01T00:00:00.000Z",
  tracker: { caughtByGen: {}, pendingByGen: {} },
  ivChecker: { savedSessions: [] },
  sectionUpdatedAt: {},
  ...over,
});

describe("tombstones carry no content", () => {
  beforeEach(() => {
    useNotesStore.setState({ entries: {} });
    useJournalStore.setState({ entries: {} });
  });

  it("deleting a note or journal entry leaves no text in the payload", () => {
    useNotesStore.getState().put("4:94", { text: "secret plan for Gengar" });
    useJournalStore
      .getState()
      .put("j1", { date: "2026-11-10", game: "platinum", text: "a private diary line", createdAt: 1 });
    useNotesStore.getState().remove("4:94");
    useJournalStore.getState().remove("j1");
    const text = JSON.stringify(buildPayload());
    expect(text).not.toContain("secret plan");
    expect(text).not.toContain("private diary");
    expect(useNotesStore.getState().entries["4:94"]).toEqual({ at: expect.any(Number), removed: true });
  });

  it("a restore removes what the backup lacks with bare tombstones", () => {
    const current: Entries<PokemonNote> = { a: { text: "old note", at: 5 } };
    expect(restoreEntries(current, {}, 10)).toEqual({ a: { at: 10, removed: true } });
  });

  it("the merge strips content from tombstones written by older versions", () => {
    const old = { a: { text: "kept by an old version", at: 9, removed: true as const } };
    expect(mergeEntries<PokemonNote>({}, old)).toEqual({ a: { at: 9, removed: true } });
    expect(mergeEntries<PokemonNote>(old, undefined)).toEqual({ a: { at: 9, removed: true } });
  });
});

describe("old tombstones are pruned at sync time", () => {
  const now = Date.parse("2026-11-10T00:00:00Z");

  it("drops tombstones older than 180 days and keeps everything else", () => {
    const entries: Entries<PokemonNote> = {
      old: { at: now - TOMBSTONE_MAX_AGE_MS - DAY, removed: true } as PokemonNote & { at: number; removed: true },
      recent: { at: now - 10 * DAY, removed: true } as PokemonNote & { at: number; removed: true },
      live: { text: "an old but live note", at: now - 400 * DAY },
    };
    expect(Object.keys(pruneTombstones(entries, now)!).sort()).toEqual(["live", "recent"]);
    const fresh = { live: entries.live };
    expect(pruneTombstones(fresh, now)).toBe(fresh);
  });

  it("mergePayload prunes when given the time, and leaves data alone without it", () => {
    const ancient = { at: now - 200 * DAY, removed: true as const };
    const local = payload({ notes: { gone: ancient as never, kept: { text: "hi", at: now } } });
    const remote = payload({ journal: { gone: ancient as never } });
    const merged = mergePayload(local, remote, now);
    expect(Object.keys(merged.notes!)).toEqual(["kept"]);
    expect(merged.journal).toEqual({});
    expect(Object.keys(mergePayload(local, remote).notes!).sort()).toEqual(["gone", "kept"]);
    // Without a server copy too (first sync)
    expect(Object.keys(mergePayload(local, null, now).notes!)).toEqual(["kept"]);
  });
});
