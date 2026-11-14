import { describe, expect, it, vi } from "vitest";
import { chooseCopies, isSaveCandidate, readWithRetry, scanFolder } from "../folder-scan";

const KB = 1024;

describe("which files a folder scan reads", () => {
  it("takes save-sized files with a save extension or none", () => {
    for (const name of ["Pokemon Platinum.sav", "emerald.SRM", "pearl.dsv", "hg.dat", "x.bin", "FIRERED"])
      expect(isSaveCandidate(name, 512 * KB), name).toBe(true);
  });

  it("leaves out games, states, hidden files and wrong sizes", () => {
    expect(isSaveCandidate("platinum.nds", 512 * KB)).toBe(false);
    expect(isSaveCandidate("platinum.ds0.state", 512 * KB)).toBe(false);
    expect(isSaveCandidate(".platinum.sav", 512 * KB)).toBe(false);
    expect(isSaveCandidate("gold.sav", 32 * KB)).toBe(false);
    expect(isSaveCandidate("rom.sav", 4 * 1024 * KB)).toBe(false);
  });

  it("skips emulator data folders and hidden folders", () => {
    expect(scanFolder("saves")).toBe(true);
    expect(scanFolder("States")).toBe(false);
    expect(scanFolder(".thumbnails")).toBe(false);
  });
});

describe("chooseCopies", () => {
  it("keeps the highest save counter, then the newest file, per profile", () => {
    const winners = chooseCopies([
      { key: "a/platinum.sav", profileId: "platinum-1-2", saveCount: 10, lastModified: 500 },
      { key: "backup/platinum.sav", profileId: "platinum-1-2", saveCount: 9, lastModified: 900 },
      { key: "b/platinum.sav", profileId: "platinum-1-2", saveCount: 10, lastModified: 600 },
      { key: "emerald.sav", profileId: "rse-3-4", saveCount: 2, lastModified: 1 },
    ]);
    expect(winners.get("platinum-1-2")).toBe("b/platinum.sav");
    expect(winners.get("rse-3-4")).toBe("emerald.sav");
  });
});

describe("readWithRetry", () => {
  const failing = () => {
    throw new Error("checksums don't match");
  };

  it("reads a recently written file a second time when the first read fails", async () => {
    const read = vi.fn().mockResolvedValue({ bytes: new Uint8Array(1), lastModified: 10_000 });
    const parse = vi.fn().mockImplementationOnce(failing).mockReturnValueOnce("ok");
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(readWithRetry(read, parse, { now: () => 12_000, wait })).resolves.toBe("ok");
    expect(read).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1000);
  });

  it("fails at once for a file that has been sitting there", async () => {
    const read = vi.fn().mockResolvedValue({ bytes: new Uint8Array(1), lastModified: 0 });
    await expect(readWithRetry(read, failing, { now: () => 60_000 })).rejects.toThrow(/checksums/);
    expect(read).toHaveBeenCalledOnce();
  });

  it("retries only once", async () => {
    const read = vi.fn().mockResolvedValue({ bytes: new Uint8Array(1), lastModified: 10_000 });
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(readWithRetry(read, failing, { now: () => 10_500, wait })).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(2);
  });
});
