/**
 * Gen III Pokémon record: 80 bytes in a box, 100 in the party. Written from
 * the documented format (Bulbapedia "Pokémon data structure (Generation III)").
 * Party records were checked against a real Emerald save; boxed records only by synthetic round trips.
 * The input buffer is never modified.
 */
import type { StatKey } from "../iv-calc";
import { Pk4Error } from "./pk4";
import { abilityForSlot3, genderFromPid, levelFromExp, nationalFromGen3, speciesName } from "./tables";
import type { SaveMon } from "./types";

export const PK3_BOX_SIZE = 80;
export const PK3_PARTY_SIZE = 100;

const DATA_START = 0x20;
const DATA_SIZE = 48;
const SUB_SIZE = 12;
const PARTY_LEVEL = 0x54;
const JAPANESE = 1;

/** For each PID % 24: the order the Growth, Attacks, EVs and Misc substructures are stored in. */
export const SUBSTRUCTURE_ORDERS: readonly string[] =
  "GAEM GAME GEAM GEMA GMAE GMEA AGEM AGME AEGM AEMG AMGE AMEG EGAM EGMA EAGM EAMG EMGA EMAG MGAE MGEA MAGE MAEG MEGA MEAG"
    .split(" ");

const GEN3_STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spe", "spAtk", "spDef"];

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

// ── Gen III text: one byte per character, 0xFF terminates ─────────────────────

const PUNCTUATION3: Record<number, string> = {
  0x00: " ", 0xab: "!", 0xac: "?", 0xad: ".", 0xae: "-", 0xb0: "…", 0xb5: "♂", 0xb6: "♀", 0xb8: ",", 0xba: "/",
};

export function decodeText3(bytes: Uint8Array, offset: number, length: number): { text: string; unsupported: boolean } {
  let text = "";
  let unknown = 0;
  for (let i = 0; i < length; i++) {
    const c = bytes[offset + i];
    if (c === 0xff) break;
    let ch: string | undefined;
    if (c >= 0xa1 && c <= 0xaa) ch = String.fromCharCode(0x30 + c - 0xa1);
    else if (c >= 0xbb && c <= 0xd4) ch = String.fromCharCode(0x41 + c - 0xbb);
    else if (c >= 0xd5 && c <= 0xee) ch = String.fromCharCode(0x61 + c - 0xd5);
    else ch = PUNCTUATION3[c];
    if (ch === undefined) unknown++;
    text += ch ?? "?";
  }
  text = text.trimEnd();
  return { text, unsupported: text.length > 0 && unknown * 2 > text.length };
}

/** Inverse of decodeText3 for the mapped subset — used to build synthetic saves in tests. */
export function encodeText3(text: string, length: number): Uint8Array {
  const reverse = new Map(Object.entries(PUNCTUATION3).map(([code, ch]) => [ch, Number(code)]));
  const out = new Uint8Array(length).fill(0xff);
  Array.from(text).slice(0, length).forEach((ch, i) => {
    const c = ch.charCodeAt(0);
    if (c >= 0x30 && c <= 0x39) out[i] = 0xa1 + c - 0x30;
    else if (c >= 0x41 && c <= 0x5a) out[i] = 0xbb + c - 0x41;
    else if (c >= 0x61 && c <= 0x7a) out[i] = 0xd5 + c - 0x61;
    else out[i] = reverse.get(ch) ?? 0xac;
  });
  return out;
}

export function checksum3(data: Uint8Array): number {
  let sum = 0;
  for (let at = 0; at < DATA_SIZE; at += 2) sum = (sum + u16(data, at)) & 0xffff;
  return sum;
}

/** XORs the 48 data bytes with PID ^ OTID, four bytes at a time. Encrypting and decrypting are the same. */
export function crypt3(record: Uint8Array): void {
  const key = (u32(record, 0x00) ^ u32(record, 0x04)) >>> 0;
  for (let at = DATA_START; at < DATA_START + DATA_SIZE; at += 4) {
    const word = (u32(record, at) ^ key) >>> 0;
    record[at] = word & 0xff;
    record[at + 1] = (word >>> 8) & 0xff;
    record[at + 2] = (word >>> 16) & 0xff;
    record[at + 3] = (word >>> 24) & 0xff;
  }
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Decodes one record. Returns null for an empty slot; throws Pk4Error (the
 * shared "unreadable Pokémon" error) on a bad checksum, bad egg or unknown species.
 */
export function decodePk3(raw: Uint8Array, box: number, slot: number): SaveMon | null {
  if (raw.length < PK3_BOX_SIZE) throw new Pk4Error("Record is too short");
  let blank = true;
  for (let i = 0; i < PK3_BOX_SIZE && blank; i++) blank = raw[i] === 0;
  if (blank) return null;

  const p = raw.slice();
  const pid = u32(p, 0x00);
  const otid = u32(p, 0x04);
  const flags = p[0x13];
  if (flags & 0x01) throw new Pk4Error("Bad egg");
  crypt3(p);
  const data = p.subarray(DATA_START, DATA_START + DATA_SIZE);
  if (checksum3(data) !== u16(p, 0x1c)) throw new Pk4Error("Checksum mismatch");

  const order = SUBSTRUCTURE_ORDERS[pid % 24];
  const G = order.indexOf("G") * SUB_SIZE;
  const A = order.indexOf("A") * SUB_SIZE;
  const E = order.indexOf("E") * SUB_SIZE;
  const M = order.indexOf("M") * SUB_SIZE;

  const internal = u16(data, G + 0x00);
  if (internal === 0) return null;
  const species = nationalFromGen3(internal);
  if (species === undefined) throw new Pk4Error(`Unknown species index ${internal}`);

  const exp = u32(data, G + 0x04);
  const ppBonuses = data[G + 0x08];
  const origins = u16(data, M + 0x02);
  const ivWord = u32(data, M + 0x04);
  const otTid = otid & 0xffff;
  const otSid = otid >>> 16;

  const ivs = {} as Record<StatKey, number>;
  const evs = {} as Record<StatKey, number>;
  GEN3_STAT_ORDER.forEach((stat, i) => {
    ivs[stat] = (ivWord >>> (i * 5)) & 0x1f;
    evs[stat] = data[E + i];
  });

  // Japanese cartridges use a different character table that isn't mapped here
  const japanese = p[0x12] === JAPANESE;
  const nickname = decodeText3(p, 0x08, 10);
  const otName = decodeText3(p, 0x14, 7);
  const isEgg = (ivWord & 0x40000000) !== 0;

  return {
    box,
    slot,
    species,
    // Unown's letter comes from the PID; other Gen III forms depend on the game, not the Pokémon
    form: species === 201
      ? ((((pid >>> 24) & 3) << 6) | (((pid >>> 16) & 3) << 4) | (((pid >>> 8) & 3) << 2) | (pid & 3)) % 28
      : 0,
    shiny: (otTid ^ otSid ^ (pid >>> 16) ^ (pid & 0xffff)) < 8,
    level: p.length >= PK3_PARTY_SIZE && p[PARTY_LEVEL] > 0 ? p[PARTY_LEVEL] : levelFromExp(species, exp),
    isEgg,
    gen: 3,
    pid,
    nickname: nickname.text,
    // Gen III has no "is nicknamed" flag: an unnamed Pokémon simply carries its species name
    isNicknamed: !isEgg && !japanese && normName(nickname.text) !== normName(speciesName(species)),
    nameUnsupported: japanese || nickname.unsupported || otName.unsupported,
    heldItem: u16(data, G + 0x02),
    otName: otName.text,
    otTid,
    otSid,
    otFemale: (origins & 0x8000) !== 0,
    exp,
    friendship: data[G + 0x09],
    ability: abilityForSlot3(species, ivWord >>> 31),
    evs,
    ivs,
    moves: [0, 1, 2, 3].map((i) => u16(data, A + i * 2)),
    pp: [0, 1, 2, 3].map((i) => data[A + 0x08 + i]),
    ppUps: [0, 1, 2, 3].map((i) => (ppBonuses >>> (i * 2)) & 3),
    nature: pid % 25,
    gender: genderFromPid(species, pid),
    // The obedience flag at the top of the ribbon word doubles as "fateful encounter"
    fateful: u32(data, M + 0x08) >>> 31 === 1,
    originGame: (origins >>> 7) & 0x0f,
    metLocation: data[M + 0x01],
    metLevel: origins & 0x7f,
    metDate: null,
    ball: (origins >>> 11) & 0x0f,
    pokerus: data[M + 0x00],
  };
}
