/**
 * Builds synthetic Gen IV records and save files for tests (and for trying the
 * Saves view in a browser without a real cartridge dump). Real .sav files are
 * personal data and are never committed.
 */
import type { StatKey } from "../../iv-calc";
import { encodeText } from "../charset4";
import { crc16ccitt, LAYOUTS, SAVE_SIZE } from "../gen4";
import { BLOCK_ORDERS, blockShift, checksumOf, cryptWords, PK4_BOX_SIZE, PK4_PARTY_SIZE } from "../pk4";
import type { Gen4Family, SpeciesInfo, SpeciesMap } from "../types";

const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spe", "spAtk", "spDef"];

export interface MonSpec {
  species: number;
  pid?: number;
  tid?: number;
  sid?: number;
  shiny?: boolean;
  exp?: number;
  ability?: number;
  friendship?: number;
  heldItem?: number;
  evs?: Partial<Record<StatKey, number>>;
  ivs?: Partial<Record<StatKey, number>>;
  moves?: number[];
  form?: number;
  female?: boolean;
  isEgg?: boolean;
  nickname?: string;
  otName?: string;
  originGame?: number;
  metLocation?: number;
  metLevel?: number;
  ball?: number;
  /** Party records only */
  level?: number;
}

const DEFAULT_TID = 12345;
const DEFAULT_SID = 54321;

function put16(b: Uint8Array, at: number, v: number) { b[at] = v & 0xff; b[at + 1] = (v >>> 8) & 0xff; }
function put32(b: Uint8Array, at: number, v: number) { put16(b, at, v & 0xffff); put16(b, at + 2, v >>> 16); }

/** The decrypted, A-B-C-D ordered form of a record. */
export function plainPk4(spec: MonSpec, party = false): Uint8Array {
  const p = new Uint8Array(party ? PK4_PARTY_SIZE : PK4_BOX_SIZE);
  const tid = spec.tid ?? DEFAULT_TID;
  const sid = spec.sid ?? DEFAULT_SID;
  // Default PID: block shift 9 (so the shuffle is exercised) and not shiny
  let pid = spec.pid ?? (0x00012345 + spec.species * 0x10000) >>> 0;
  if (spec.shiny) pid = ((((tid ^ sid ^ (pid & 0xffff)) & 0xffff) << 16) | (pid & 0xffff)) >>> 0;

  const [A, B, C, D] = [0x08, 0x28, 0x48, 0x68];
  put32(p, 0x00, pid);
  put16(p, A + 0x00, spec.species);
  put16(p, A + 0x02, spec.heldItem ?? 0);
  put16(p, A + 0x04, tid);
  put16(p, A + 0x06, sid);
  put32(p, A + 0x08, spec.exp ?? 0);
  p[A + 0x0c] = spec.friendship ?? 70;
  p[A + 0x0d] = spec.ability ?? 1;
  STAT_ORDER.forEach((stat, i) => { p[A + 0x10 + i] = spec.evs?.[stat] ?? 0; });

  (spec.moves ?? [33]).forEach((move, i) => { put16(p, B + i * 2, move); p[B + 0x08 + i] = 35; });
  let ivWord = 0;
  STAT_ORDER.forEach((stat, i) => { ivWord |= (spec.ivs?.[stat] ?? 0) << (i * 5); });
  if (spec.isEgg) ivWord |= 0x40000000;
  if (spec.nickname) ivWord |= 0x80000000;
  put32(p, B + 0x10, ivWord >>> 0);
  p[B + 0x18] = ((spec.form ?? 0) << 3) | (spec.female ? 0x02 : 0);
  put16(p, B + 0x1e, spec.metLocation ?? 0);

  p.set(encodeText(spec.nickname ?? "MON", 11), C + 0x00);
  p[C + 0x17] = spec.originGame ?? 12;

  p.set(encodeText(spec.otName ?? "Tester", 8), D + 0x00);
  p.set([9, 4, 28], D + 0x13); // met 2009-04-28
  p[D + 0x1b] = spec.ball ?? 4;
  p[D + 0x1c] = spec.metLevel ?? 5;

  if (party) p[0x8c] = spec.level ?? 1;
  put16(p, 0x06, checksumOf(p));
  return p;
}

/** Checksum → shuffle → encrypt: the record as it sits in a save file. */
export function buildPk4(spec: MonSpec, party = false): Uint8Array {
  const plain = plainPk4(spec, party);
  const pid = (plain[0] | (plain[1] << 8) | (plain[2] << 16) | (plain[3] << 24)) >>> 0;
  const out = plain.slice();
  const order = BLOCK_ORDERS[blockShift(pid)];
  for (let pos = 0; pos < 4; pos++) {
    const from = 0x08 + order[pos] * 32;
    out.set(plain.subarray(from, from + 32), 0x08 + pos * 32);
  }
  cryptWords(out, 0x08, 0x88, plain[0x06] | (plain[0x07] << 8));
  if (party) cryptWords(out, 0x88, PK4_PARTY_SIZE, pid);
  return out;
}

export interface SaveSpec {
  family?: Gen4Family;
  trainerName?: string;
  tid?: number;
  sid?: number;
  saveCount?: number;
  party?: MonSpec[];
  /** "box:slot" (both 0-based) → Pokémon */
  boxes?: Record<string, MonSpec>;
  boxNames?: string[];
  /** "box:slot" keys whose record gets a flipped byte (the block checksum stays valid) */
  corrupt?: string[];
  /**
   * Mimics the real-save trap: the newest general block is in slot 2, its boxes
   * are in slot 1, and slot 2's storage block is an older, emptier copy.
   */
  splitSlots?: boolean;
}

function writeFooter(bytes: Uint8Array, start: number, size: number, link: number, counter: number, id: number, footerSize: number) {
  const end = start + size;
  const footer = end - footerSize;
  // HGSS has no link value: its 0x10-byte footer starts at the counter
  if (footerSize === 0x14) put32(bytes, footer, link);
  put32(bytes, end - 0x10, counter);
  put32(bytes, end - 0x0c, size);
  put32(bytes, end - 0x08, 0x20060623);
  put16(bytes, end - 0x04, id);
  put16(bytes, end - 0x02, crc16ccitt(bytes, start, footer));
}

export function buildSave(spec: SaveSpec = {}): Uint8Array {
  const family = spec.family ?? "platinum";
  const layout = LAYOUTS[family];
  const tid = spec.tid ?? DEFAULT_TID;
  const sid = spec.sid ?? DEFAULT_SID;
  const counter = spec.saveCount ?? 10;
  const bytes = new Uint8Array(SAVE_SIZE);
  const own = (m: MonSpec): MonSpec => ({ tid, sid, ...m });

  const writeGeneral = (slot: number, count: number, link: number) => {
    const g = slot * 0x40000;
    bytes.set(encodeText(spec.trainerName ?? "Tester", 8), g + layout.trainerName);
    put16(bytes, g + layout.tid, tid);
    put16(bytes, g + layout.sid, sid);
    const party = spec.party ?? [];
    bytes[g + layout.partyCount] = party.length;
    party.forEach((m, i) => bytes.set(buildPk4(own(m), true), g + layout.party + i * PK4_PARTY_SIZE));
    writeFooter(bytes, g, layout.generalSize, link, count, 0, layout.footerSize);
  };
  const writeStorage = (slot: number, count: number, link: number, boxes: Record<string, MonSpec>) => {
    const s = slot * 0x40000 + layout.storageStart;
    for (const [key, m] of Object.entries(boxes)) {
      const [box, index] = key.split(":").map(Number);
      const at = s + layout.boxData + box * layout.boxStride + index * PK4_BOX_SIZE;
      bytes.set(buildPk4(own(m)), at);
      if (spec.corrupt?.includes(key)) bytes[at + 0x20] ^= 0xff;
    }
    for (let box = 0; box < 18; box++) {
      bytes.set(encodeText(spec.boxNames?.[box] ?? `BOX ${box + 1}`, 20), s + layout.boxNames + box * 40);
    }
    writeFooter(bytes, s, layout.storageSize, link, count, 1, layout.footerSize);
  };

  if (spec.splitSlots) {
    writeGeneral(0, counter - 1, 0xd5);
    writeStorage(0, counter, 0xd6, spec.boxes ?? {});
    writeGeneral(1, counter, 0xd6);
    writeStorage(1, counter - 1, 0xd5, {});
  } else {
    writeGeneral(0, counter, 1);
    writeStorage(0, counter, 1, spec.boxes ?? {});
  }
  return bytes;
}

/**
 * A few real evolution lines, enough to exercise the living-dex logic:
 * Caterpie → Metapod → Butterfree · Zubat → Golbat → Crobat ·
 * Pichu (baby) → Pikachu → Raichu · Eevee → its seven Gen IV evolutions · Tauros (no evolutions)
 */
export function miniDex(): SpeciesMap {
  const lines: [number, string, number | null, boolean?][] = [
    [10, "Caterpie", null], [11, "Metapod", 10], [12, "Butterfree", 11],
    [41, "Zubat", null], [42, "Golbat", 41], [169, "Crobat", 42],
    [172, "Pichu", null, true], [25, "Pikachu", 172], [26, "Raichu", 25],
    [133, "Eevee", null],
    [134, "Vaporeon", 133], [135, "Jolteon", 133], [136, "Flareon", 133], [196, "Espeon", 133],
    [197, "Umbreon", 133], [470, "Leafeon", 133], [471, "Glaceon", 133],
    [128, "Tauros", null],
  ];
  const dex = new Map<number, SpeciesInfo>(
    lines.map(([id, displayName, evolvesFrom, isBaby]) => [id, { id, displayName, evolvesFrom, isBaby: !!isBaby, evolvesTo: [] }]),
  );
  for (const info of dex.values()) {
    if (info.evolvesFrom !== null) dex.get(info.evolvesFrom)!.evolvesTo.push({ speciesId: info.id });
  }
  return dex;
}
