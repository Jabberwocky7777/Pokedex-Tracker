/**
 * Gen IV save file reader (Diamond, Pearl, Platinum, HeartGold, SoulSilver).
 *
 * A save holds two copies ("slots") of two blocks each: a general block
 * (trainer, party) and a storage block (PC boxes). The game alternates slots,
 * and only rewrites storage when the boxes change — so the newest general block
 * and the boxes that belong to it are often in different slots.
 *
 * Read-only by design: nothing here writes to the buffer it is given.
 * The Platinum layout was checked against a real cartridge save. For Diamond/Pearl
 * only the header (detection, checksum, trainer, box names) has been checked, on a
 * real Pearl save with no Pokémon yet. The HGSS block footer, trainer, party and
 * boxes were checked against a real SoulSilver save.
 */
import { decodeText } from "./charset4";
import { decodePk4, Pk4Error, PK4_BOX_SIZE, PK4_PARTY_SIZE } from "./pk4";
import { originGameName } from "./tables";
import {
  BOX_COUNT, BOX_SIZE, PARTY_BOX, SaveParseError,
  type Gen4Family, type ParsedSave, type SaveFamily, type SaveMon, type SaveTrainer,
} from "./types";

export const SAVE_SIZE = 0x80000;
const SLOT_SIZE = 0x40000;
const BOX_NAME_BYTES = 40;

export interface Gen4Layout {
  generalSize: number;
  storageStart: number;
  storageSize: number;
  trainerName: number;
  tid: number;
  sid: number;
  partyCount: number;
  party: number;
  /** Offset of box 1 within the storage block */
  boxData: number;
  /** Bytes from one box to the next (HGSS pads each box to 0x1000) */
  boxStride: number;
  /** Offset of the 18 box names within the storage block */
  boxNames: number;
  /** Bytes of footer at the end of each block: 0x14 on Diamond/Pearl/Platinum, 0x10 on HGSS (no link value) */
  footerSize: number;
}

export const LAYOUTS: Record<Gen4Family, Gen4Layout> = {
  platinum: {
    generalSize: 0xcf2c, storageStart: 0xcf2c, storageSize: 0x121e4,
    trainerName: 0x68, tid: 0x78, sid: 0x7a,
    // Bulbapedia lists the party at 0x98; on a real cartridge it is at 0xA0.
    partyCount: 0x9c, party: 0xa0,
    boxData: 0x04, boxStride: BOX_SIZE * PK4_BOX_SIZE, boxNames: 0x11ee4, footerSize: 0x14,
  },
  dp: {
    generalSize: 0xc100, storageStart: 0xc100, storageSize: 0x121e0,
    trainerName: 0x64, tid: 0x74, sid: 0x76,
    partyCount: 0x94, party: 0x98,
    boxData: 0x04, boxStride: BOX_SIZE * PK4_BOX_SIZE, boxNames: 0x11ee4, footerSize: 0x14,
  },
  hgss: {
    generalSize: 0xf628, storageStart: 0xf700, storageSize: 0x12310,
    trainerName: 0x64, tid: 0x74, sid: 0x76,
    partyCount: 0x94, party: 0x98,
    boxData: 0x00, boxStride: 0x1000, boxNames: 0x12008, footerSize: 0x10,
  },
};

const FAMILY_ORDER: Gen4Family[] = ["platinum", "dp", "hgss"];

/** Families whose layout hasn't been fully checked against a real save (Platinum and HGSS have been). */
export const UNVERIFIED_FAMILIES: SaveFamily[] = ["dp", "rse", "frlg"];

export const FAMILY_LABELS: Record<SaveFamily, string> = {
  platinum: "Platinum",
  dp: "Diamond/Pearl",
  hgss: "HeartGold/SoulSilver",
  rse: "Ruby/Sapphire/Emerald",
  frlg: "FireRed/LeafGreen",
};

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** CRC-16-CCITT (init 0xFFFF, polynomial 0x1021) — "123456789" → 0x29B1. */
export function crc16ccitt(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0xffff;
  for (let i = start; i < end; i++) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

interface Block {
  /** Absolute offset of the block in the file */
  start: number;
  slot: number;
  link: number;
  counter: number;
}

/**
 * Reads the footer of one block; returns null unless the size and checksum agree.
 *
 * Diamond/Pearl/Platinum footer (0x14 bytes): +0x00 link value, +0x04 save counter,
 * +0x08 block size, +0x0C magic, +0x10 block id, +0x12 CRC.
 * HeartGold/SoulSilver footer (0x10 bytes, checked on a real SoulSilver cartridge
 * save): +0x00 save counter, +0x04 block size, +0x08 magic, +0x0C block id, +0x0E CRC.
 * There is no link value there; a general block and its boxes share the counter,
 * so the counter doubles as the link.
 * The size field and the CRC sit at the same distance from the end in both.
 */
function readBlock(bytes: Uint8Array, slot: number, offset: number, size: number, footerSize: number): Block | null {
  const start = slot * SLOT_SIZE + offset;
  const end = start + size;
  const footer = end - footerSize;
  if (u32(bytes, end - 0x0c) !== size) return null;
  if (crc16ccitt(bytes, start, footer) !== u16(bytes, end - 0x02)) return null;
  const counter = u32(bytes, end - 0x10);
  return { start, slot, link: footerSize === 0x14 ? u32(bytes, footer) : counter, counter };
}

const newest = (blocks: Block[]) => blocks.reduce((a, b) => (b.counter > a.counter ? b : a));

export function detectFamily(bytes: Uint8Array): Gen4Family | null {
  for (const family of FAMILY_ORDER) {
    const { generalSize } = LAYOUTS[family];
    for (const slot of [0, 1]) {
      if (u32(bytes, slot * SLOT_SIZE + generalSize - 0x0c) === generalSize) return family;
    }
  }
  return null;
}

/** Diamond vs Pearl (and HG vs SS) isn't stored — go by where the trainer's own Pokémon came from. */
function guessGame(family: Gen4Family, trainer: SaveTrainer, mons: SaveMon[]): string {
  if (family === "platinum") return "Platinum";
  const candidates = family === "dp" ? [10, 11] : [7, 8];
  const counts = new Map<number, number>();
  for (const m of mons) {
    if (m.otTid !== trainer.tid || m.otSid !== trainer.sid || !candidates.includes(m.originGame)) continue;
    counts.set(m.originGame, (counts.get(m.originGame) ?? 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  return best ? originGameName(best[0]) : FAMILY_LABELS[family];
}

/**
 * Parses a .sav dump. Throws SaveParseError with a message fit to show the user
 * when the file isn't a readable Gen IV save. Problems that don't stop the
 * parse (unreadable slots, stale boxes) are reported in `warnings`.
 */
export function parseGen4Save(input: Uint8Array): ParsedSave {
  if (input.length < SAVE_SIZE) {
    throw new SaveParseError(
      "This file is too small to be a DS save. A Diamond, Pearl, Platinum, HeartGold or SoulSilver save is 512 KB — " +
      ".nds and .gba files are the games themselves, not saves.",
    );
  }
  // Emulators such as DeSmuME append a footer; only the first 512 KB is the save.
  const bytes = input.subarray(0, SAVE_SIZE);

  const family = detectFamily(bytes);
  if (!family) {
    throw new SaveParseError("This doesn't look like a Diamond, Pearl, Platinum, HeartGold or SoulSilver save.");
  }
  const layout = LAYOUTS[family];
  const warnings: string[] = [];

  const generals = [0, 1]
    .map((slot) => readBlock(bytes, slot, 0, layout.generalSize, layout.footerSize))
    .filter((b): b is Block => b !== null);
  if (generals.length === 0) {
    throw new SaveParseError("The save's checksums don't match — the file may be corrupt or incomplete.");
  }
  const general = newest(generals);

  const storages = [0, 1]
    .map((slot) => readBlock(bytes, slot, layout.storageStart, layout.storageSize, layout.footerSize))
    .filter((b): b is Block => b !== null);
  let storage = storages.find((b) => b.link === general.link) ?? null;
  if (!storage && storages.length > 0) {
    storage = newest(storages);
    warnings.push("Couldn't match the PC boxes to the latest save, so the newest boxes found were used. They may be slightly out of date.");
  }
  if (!storage) {
    warnings.push("The PC boxes couldn't be read (their checksum doesn't match). Only the party was imported.");
  }

  const g = general.start;
  const trainer: SaveTrainer = {
    name: decodeText(bytes, g + layout.trainerName, 8).text,
    tid: u16(bytes, g + layout.tid),
    sid: u16(bytes, g + layout.sid),
  };

  const mons: SaveMon[] = [];
  let unreadable = 0;
  const read = (at: number, size: number, box: number, slot: number) => {
    try {
      const mon = decodePk4(bytes.subarray(at, at + size), box, slot);
      if (mon) mons.push({ ...mon, own: mon.otTid === trainer.tid && mon.otSid === trainer.sid });
    } catch (err) {
      if (!(err instanceof Pk4Error)) throw err;
      unreadable++;
    }
  };

  const partyCount = Math.min(bytes[g + layout.partyCount], 6);
  for (let i = 0; i < partyCount; i++) {
    read(g + layout.party + i * PK4_PARTY_SIZE, PK4_PARTY_SIZE, PARTY_BOX, i);
  }

  const boxNames: string[] = [];
  if (storage) {
    const s = storage.start;
    for (let box = 0; box < BOX_COUNT; box++) {
      for (let slot = 0; slot < BOX_SIZE; slot++) {
        read(s + layout.boxData + box * layout.boxStride + slot * PK4_BOX_SIZE, PK4_BOX_SIZE, box, slot);
      }
      const name = decodeText(bytes, s + layout.boxNames + box * BOX_NAME_BYTES, BOX_NAME_BYTES / 2);
      boxNames.push(name.text && !name.unsupported ? name.text : `Box ${box + 1}`);
    }
  } else {
    for (let box = 0; box < BOX_COUNT; box++) boxNames.push(`Box ${box + 1}`);
  }

  if (unreadable > 0) {
    warnings.push(`${unreadable} slot${unreadable === 1 ? "" : "s"} couldn't be read and ${unreadable === 1 ? "was" : "were"} skipped.`);
  }

  return {
    family,
    game: guessGame(family, trainer, mons),
    trainer,
    saveCount: general.counter,
    boxNames,
    mons,
    warnings,
  };
}
