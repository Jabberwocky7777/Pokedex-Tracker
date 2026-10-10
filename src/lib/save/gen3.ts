/**
 * Gen III (Game Boy Advance) save reader: Ruby, Sapphire, Emerald, FireRed, LeafGreen.
 *
 * PARTLY VERIFIED: block and section selection, the trainer, the party (species,
 * level, nature, ability, moves, met data) and the box names were checked
 * against one real Emerald save. Its PC was empty, so boxed Pokémon — and the
 * whole FireRed/LeafGreen layout — have only been exercised by synthetic
 * round-trip tests. Treat those offsets as provisional.
 *
 * A 128 KB save holds two blocks of 14 sections (4 KB each). The game writes
 * the blocks alternately and rotates the section order on every save, so
 * sections are found by the id in their footer, not by position.
 * Read-only: nothing here writes to the buffer it is given.
 */
import { decodePk3, decodeText3, PK3_BOX_SIZE, PK3_PARTY_SIZE } from "./pk3";
import { Pk4Error } from "./pk4";
import { originGameName } from "./tables";
import { BOX_SIZE, PARTY_BOX, SaveParseError, type Gen3Family, type ParsedSave, type SaveMon, type SaveTrainer } from "./types";

export const GBA_SAVE_SIZE = 0x20000;
export const SECTION_SIZE = 0x1000;
export const SECTIONS_PER_BLOCK = 14;
export const SECTION_SIGNATURE = 0x08012025;
const GEN3_BOX_COUNT = 14;
const BLOCK_SIZE = SECTION_SIZE * SECTIONS_PER_BLOCK;
const BOX_NAME_BYTES = 9;

/** How many bytes of each section (by id) hold data and are covered by its checksum. */
export function sectionDataSize(id: number): number {
  if (id === 0) return 3884;
  if (id === 4) return 3848;
  if (id === 13) return 2000;
  return 3968;
}

export const TEAM_OFFSETS: Record<Gen3Family, { count: number; data: number }> = {
  rse: { count: 0x234, data: 0x238 },
  frlg: { count: 0x34, data: 0x38 },
};

// PC buffer (sections 5–13 joined): current box, 420 Pokémon, then the box names
const PC_MONS = 0x0004;
const PC_BOX_NAMES = 0x8344;

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** Sum of the 32-bit words, folded to 16 bits (upper half + lower half). */
export function sectionChecksum(bytes: Uint8Array, start: number, size: number): number {
  let sum = 0;
  for (let at = start; at < start + size; at += 4) sum = (sum + u32(bytes, at)) >>> 0;
  return ((sum >>> 16) + (sum & 0xffff)) & 0xffff;
}

interface Block {
  saveIndex: number;
  /** Section id → absolute offset of its data */
  sections: Map<number, number>;
}

/** Reads one block; null unless all 14 sections are present with a good signature and checksum. */
function readBlock(bytes: Uint8Array, base: number): Block | null {
  const sections = new Map<number, number>();
  let saveIndex = 0;
  for (let i = 0; i < SECTIONS_PER_BLOCK; i++) {
    const at = base + i * SECTION_SIZE;
    const id = u16(bytes, at + 0xff4);
    if (id >= SECTIONS_PER_BLOCK || sections.has(id)) return null;
    if (u32(bytes, at + 0xff8) !== SECTION_SIGNATURE) return null;
    if (sectionChecksum(bytes, at, sectionDataSize(id)) !== u16(bytes, at + 0xff6)) return null;
    sections.set(id, at);
    saveIndex = u32(bytes, at + 0xffc);
  }
  return { saveIndex, sections };
}

function guessGame(family: Gen3Family, trainer: SaveTrainer, mons: SaveMon[], securityKey: number): string {
  const candidates = family === "frlg" ? [4, 5] : [1, 2, 3];
  const counts = new Map<number, number>();
  for (const m of mons) {
    if (m.otTid !== trainer.tid || m.otSid !== trainer.sid || !candidates.includes(m.originGame)) continue;
    counts.set(m.originGame, (counts.get(m.originGame) ?? 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (best) return originGameName(best[0]);
  if (family === "frlg") return "FireRed/LeafGreen";
  // Emerald keeps a security key where Ruby and Sapphire have zero (unconfirmed)
  return securityKey !== 0 ? "Emerald" : "Ruby/Sapphire";
}

export function parseGen3Save(input: Uint8Array): ParsedSave {
  if (input.length < GBA_SAVE_SIZE) {
    throw new SaveParseError("This file is too small to be a Game Boy Advance save (those are 128 KB).");
  }
  const bytes = input.subarray(0, GBA_SAVE_SIZE);

  const blocks = [0, BLOCK_SIZE].map((base) => readBlock(bytes, base)).filter((b): b is Block => b !== null);
  if (blocks.length === 0) {
    throw new SaveParseError("This doesn't look like a Ruby, Sapphire, Emerald, FireRed or LeafGreen save, or its checksums don't match.");
  }
  // The other block is the previous save; it is only used when the newer one is damaged
  const block = blocks.reduce((a, b) => (b.saveIndex > a.saveIndex ? b : a));
  const warnings: string[] = [];
  if (blocks.length === 1) {
    // Normal for a game saved only once; otherwise it means one copy failed its checksums
    const other = block.sections.get(0)! < BLOCK_SIZE ? BLOCK_SIZE : 0;
    const hasData = bytes.subarray(other, other + BLOCK_SIZE).some((b) => b !== 0 && b !== 0xff);
    if (hasData) warnings.push("One of the two copies in this save is damaged, so the other one was used. It may be one save behind.");
  }

  const s0 = block.sections.get(0)!;
  const family: Gen3Family = u32(bytes, s0 + 0xac) === 1 ? "frlg" : "rse";
  const trainer: SaveTrainer = {
    name: decodeText3(bytes, s0 + 0x00, 7).text,
    tid: u16(bytes, s0 + 0x0a),
    sid: u16(bytes, s0 + 0x0c),
  };

  const mons: SaveMon[] = [];
  let unreadable = 0;
  const read = (record: Uint8Array, box: number, slot: number) => {
    try {
      const mon = decodePk3(record, box, slot);
      if (mon) mons.push({ ...mon, own: mon.otTid === trainer.tid && mon.otSid === trainer.sid });
    } catch (err) {
      if (!(err instanceof Pk4Error)) throw err;
      unreadable++;
    }
  };

  const s1 = block.sections.get(1)!;
  const team = TEAM_OFFSETS[family];
  const partyCount = Math.min(u32(bytes, s1 + team.count), 6);
  for (let i = 0; i < partyCount; i++) {
    const at = s1 + team.data + i * PK3_PARTY_SIZE;
    read(bytes.subarray(at, at + PK3_PARTY_SIZE), PARTY_BOX, i);
  }

  // The PC is one buffer spread across sections 5–13
  const pcSize = Array.from({ length: 9 }, (_, i) => sectionDataSize(5 + i)).reduce((a, b) => a + b, 0);
  const pc = new Uint8Array(pcSize);
  let filled = 0;
  for (let id = 5; id <= 13; id++) {
    const size = sectionDataSize(id);
    pc.set(bytes.subarray(block.sections.get(id)!, block.sections.get(id)! + size), filled);
    filled += size;
  }

  const boxNames: string[] = [];
  for (let box = 0; box < GEN3_BOX_COUNT; box++) {
    for (let slot = 0; slot < BOX_SIZE; slot++) {
      const at = PC_MONS + (box * BOX_SIZE + slot) * PK3_BOX_SIZE;
      read(pc.subarray(at, at + PK3_BOX_SIZE), box, slot);
    }
    const name = decodeText3(pc, PC_BOX_NAMES + box * BOX_NAME_BYTES, BOX_NAME_BYTES);
    boxNames.push(name.text && !name.unsupported ? name.text : `Box ${box + 1}`);
  }

  if (unreadable > 0) {
    warnings.push(`${unreadable} slot${unreadable === 1 ? "" : "s"} couldn't be read and ${unreadable === 1 ? "was" : "were"} skipped.`);
  }

  return {
    family,
    game: guessGame(family, trainer, mons, u32(bytes, s0 + 0xac)),
    trainer,
    saveCount: block.saveIndex,
    boxNames,
    mons,
    warnings,
  };
}
