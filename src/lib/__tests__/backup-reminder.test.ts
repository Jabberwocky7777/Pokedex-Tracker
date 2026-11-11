import { afterEach, describe, expect, it, vi } from "vitest";
import { backupAgeText, lastBackupAt, noteBackupMade, weeklyFolderBackup, WEEK_MS } from "../backup-reminder";
import { storageSet } from "../save/storage";

const DAY = 24 * 60 * 60 * 1000;

afterEach(() => localStorage.clear());

describe("backup reminders", () => {
  it("remembers when the last backup was made, and says how long ago", () => {
    expect(lastBackupAt()).toBeNull();
    noteBackupMade(1000);
    expect(lastBackupAt()).toBe(1000);
    const now = Date.parse("2026-11-10T12:00:00Z");
    expect(backupAgeText(now - 1000, now)).toBe("today");
    expect(backupAgeText(now - DAY, now)).toBe("yesterday");
    expect(backupAgeText(now - 43 * DAY, now)).toBe("43 days ago");
  });

  it("writes a weekly backup to the folder only when one is due and writing is allowed", async () => {
    const written: string[] = [];
    const folder = (permission: PermissionState) => ({
      kind: "directory" as const,
      name: "Backups",
      queryPermission: () => Promise.resolve(permission),
      getFileHandle: (name: string) =>
        Promise.resolve({
          createWritable: () =>
            Promise.resolve({
              write: (data: string) => {
                written.push(name);
                expect(JSON.parse(data).version).toBe(2);
                return Promise.resolve();
              },
              close: () => Promise.resolve(),
            }),
        }),
    });
    const now = Date.now();
    expect(await weeklyFolderBackup(now)).toBe(false); // no folder chosen

    await storageSet("backup-folder", folder("prompt"));
    expect(await weeklyFolderBackup(now)).toBe(false); // would need to ask

    await storageSet("backup-folder", folder("granted"));
    noteBackupMade(now - 2 * DAY);
    expect(await weeklyFolderBackup(now)).toBe(false); // not due yet
    noteBackupMade(now - WEEK_MS - 1);
    expect(await weeklyFolderBackup(now)).toBe(true);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(/^pokedex-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(lastBackupAt()).toBeGreaterThanOrEqual(now - 1000);
    vi.restoreAllMocks();
  });
});
