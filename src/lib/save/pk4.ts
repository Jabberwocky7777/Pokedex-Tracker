/**
 * Gen IV Pokémon record: 136 bytes in a box, 236 in the party (the extra 100
 * are battle stats). Written from the documented format (Bulbapedia, Project
 * Pokémon) — the input buffer is never modified.
 */
import type { StatKey } from "../iv-calc";
import { decodeText } from "./charset4";
import { levelFromExp } from "./tables";
import { MAX_SPECIES_GEN4, type Gender, type SaveMon } from "./types";

export const PK4_BOX_SIZE = 136;
export const PK4_PARTY_SIZE = 236;

const DATA_START = 0x08;
const DATA_END = 0x88;
const BLOCK_SIZE = 32;
const PARTY_LEVEL = 0x8c;

// Offsets of the four 32-byte blocks once they are back in A-B-C-D order
const A = 0x08;
const B = 0x28;
const C = 0x48;
const D = 0x68;

/** For each shift value, which block (0=A … 3=D) is stored in positions 0–3. */
export const BLOCK_ORDERS: readonly (readonly number[])[] =
  "ABCD ABDC ACBD ACDB ADBC ADCB BACD BADC BCAD BCDA BDAC BDCA CABD CADB CBAD CBDA CDAB CDBA DABC DACB DBAC DBCA DCAB DCBA"
    .split(" ")
    .map((order) => Array.from(order, (letter) => letter.charCodeAt(0) - 65));

/** Stat order used by both the EV bytes and the packed IV word. */
const GEN4_STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spe", "spAtk", "spDef"];

export class Pk4Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pk4Error";
  }
}

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

export function blockShift(pid: number): number {
  return ((pid & 0x3e000) >>> 13) % 24;
}

/** XORs the 16-bit words in [start, end) with the game's LCG stream. Encrypting and decrypting are the same operation. */
export function cryptWords(bytes: Uint8Array, start: number, end: number, seed: number): void {
  let state = seed >>> 0;
  for (let at = start; at + 1 < end; at += 2) {
    state = (Math.imul(state, 0x41c64e6d) + 0x6073) >>> 0;
    const word = u16(bytes, at) ^ (state >>> 16);
    bytes[at] = word & 0xff;
    bytes[at + 1] = (word >>> 8) & 0xff;
  }
}

export function checksumOf(plain: Uint8Array): number {
  let sum = 0;
  for (let at = DATA_START; at < DATA_END; at += 2) sum = (sum + u16(plain, at)) & 0xffff;
  return sum;
}

/**
 * Returns a decrypted copy with the blocks back in A-B-C-D order.
 * Throws Pk4Error when the checksum doesn't match (a corrupt or foreign record).
 */
export function decryptPk4(raw: Uint8Array): Uint8Array {
  if (raw.length < PK4_BOX_SIZE) throw new Pk4Error("Record is too short");
  const work = raw.slice();
  const pid = u32(work, 0x00);
  const checksum = u16(work, 0x06);

  cryptWords(work, DATA_START, DATA_END, checksum);
  if (checksumOf(work) !== checksum) throw new Pk4Error("Checksum mismatch");

  const out = work.slice();
  const order = BLOCK_ORDERS[blockShift(pid)];
  for (let pos = 0; pos < 4; pos++) {
    const from = DATA_START + pos * BLOCK_SIZE;
    out.set(work.subarray(from, from + BLOCK_SIZE), DATA_START + order[pos] * BLOCK_SIZE);
  }
  if (out.length >= PK4_PARTY_SIZE) cryptWords(out, DATA_END, PK4_PARTY_SIZE, pid);
  return out;
}

function isBlank(raw: Uint8Array): boolean {
  for (let i = 0; i < PK4_BOX_SIZE; i++) if (raw[i] !== 0) return false;
  return true;
}

/**
 * Decodes one record. Returns null for an empty slot; throws Pk4Error if the
 * record can't be trusted (bad checksum, bad egg, impossible species).
 */
export function decodePk4(raw: Uint8Array, box: number, slot: number): SaveMon | null {
  // Never-used slots can be all zeroes; Platinum writes an encrypted blank instead (species 0).
  if (isBlank(raw)) return null;
  const p = decryptPk4(raw);

  const species = u16(p, A + 0x00);
  if (species === 0) return null;
  if (species > MAX_SPECIES_GEN4) throw new Pk4Error(`Unknown species ${species}`);
  if (u16(p, 0x04) & 0x04) throw new Pk4Error("Bad egg");

  const pid = u32(p, 0x00);
  const otTid = u16(p, A + 0x04);
  const otSid = u16(p, A + 0x06);
  const exp = u32(p, A + 0x08);

  const ivWord = u32(p, B + 0x10);
  const ivs = {} as Record<StatKey, number>;
  const evs = {} as Record<StatKey, number>;
  GEN4_STAT_ORDER.forEach((stat, i) => {
    ivs[stat] = (ivWord >>> (i * 5)) & 0x1f;
    evs[stat] = p[A + 0x10 + i];
  });

  const flags = p[B + 0x18];
  const gender: Gender = flags & 0x04 ? "genderless" : flags & 0x02 ? "female" : "male";

  const nickname = decodeText(p, C + 0x00, 11);
  const otName = decodeText(p, D + 0x00, 8);

  const [yy, mm, dd] = [p[D + 0x13], p[D + 0x14], p[D + 0x15]];
  const metLevelByte = p[D + 0x1c];
  // Platinum and HGSS moved the met location; Diamond/Pearl-era data only has the old field.
  const metLocation = u16(p, B + 0x1e) || u16(p, D + 0x18);
  // HGSS keeps its own ball byte so Apricorn balls survive a trade back to Sinnoh games
  const ball = p[D + 0x1e] || p[D + 0x1b];

  const level = p.length >= PK4_PARTY_SIZE && p[PARTY_LEVEL] > 0 ? p[PARTY_LEVEL] : levelFromExp(species, exp);

  return {
    box,
    slot,
    species,
    form: flags >>> 3,
    shiny: (otTid ^ otSid ^ (pid >>> 16) ^ (pid & 0xffff)) < 8,
    level,
    isEgg: (ivWord & 0x40000000) !== 0,
    pid,
    nickname: nickname.text,
    isNicknamed: ivWord >>> 31 === 1,
    nameUnsupported: nickname.unsupported || otName.unsupported,
    heldItem: u16(p, A + 0x02),
    otName: otName.text,
    otTid,
    otSid,
    otFemale: (metLevelByte & 0x80) !== 0,
    exp,
    friendship: p[A + 0x0c],
    ability: p[A + 0x0d],
    evs,
    ivs,
    moves: [0, 1, 2, 3].map((i) => u16(p, B + i * 2)),
    pp: [0, 1, 2, 3].map((i) => p[B + 0x08 + i]),
    ppUps: [0, 1, 2, 3].map((i) => p[B + 0x0c + i]),
    nature: pid % 25,
    gender,
    fateful: (flags & 0x01) !== 0,
    originGame: p[C + 0x17],
    metLocation,
    metLevel: metLevelByte & 0x7f,
    metDate: mm >= 1 && mm <= 12 ? [2000 + yy, mm, dd] : null,
    ball,
    pokerus: p[D + 0x1a],
  };
}
