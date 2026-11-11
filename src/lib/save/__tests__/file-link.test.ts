import { describe, expect, it } from "vitest";
import {
  canLinkFiles,
  forgetSaveFile,
  linkedFileChangedAt,
  linkedFileName,
  readLinkedFile,
  rememberSaveFile,
} from "../file-link";

const fakeHandle = (permission: PermissionState, afterRequest: PermissionState = permission) => {
  const file = { name: "pt.sav", lastModified: 1234 } as File;
  return {
    kind: "file" as const,
    name: "pt.sav",
    getFile: () => Promise.resolve(file),
    queryPermission: () => Promise.resolve(permission),
    requestPermission: () => Promise.resolve(afterRequest),
  };
};

describe("linked save files", () => {
  it("isn't offered without the File System Access API", () => {
    expect(canLinkFiles()).toBe(false);
  });

  it("remembers a handle per save and reads it again", async () => {
    await rememberSaveFile("platinum-1-2", fakeHandle("granted"));
    expect(await linkedFileName("platinum-1-2")).toBe("pt.sav");
    expect((await readLinkedFile("platinum-1-2"))?.name).toBe("pt.sav");
    expect(await linkedFileChangedAt("platinum-1-2")).toBe(1234);
    await forgetSaveFile("platinum-1-2");
    expect(await linkedFileName("platinum-1-2")).toBeNull();
    expect(await readLinkedFile("platinum-1-2")).toBeNull();
  });

  it("asks again when reading isn't allowed any more, and gives up if refused", async () => {
    await rememberSaveFile("a", fakeHandle("prompt", "granted"));
    expect((await readLinkedFile("a"))?.name).toBe("pt.sav");
    expect(await linkedFileChangedAt("a")).toBeNull(); // no prompt just to look
    await rememberSaveFile("b", fakeHandle("prompt", "denied"));
    expect(await readLinkedFile("b")).toBeNull();
  });
});
