/**
 * Builds synthetic Gen III records and save files for tests. Real saves are
 * personal data and are never committed.
 */
import tables from "../../../data/save-tables.json";
import type { StatKey } from "../../iv-calc";
import {
  GBA_SAVE_SIZE, SECTION_SIGNATURE, SECTION_SIZE, SECTIONS_PER_BLOCK, TEAM_OFFSETS, sectionChecksum, sectionDataSize,
} from "../gen3";
import { checksum3, crypt3, encodeText3, PK3_BOX_SIZE, PK3_PARTY_SIZE, SUBSTRUCTURE_ORDERS } from "../pk3";
import type { Gen3Family } from "../types";

const STAT_ORDER: StatKey[] = ["hp", "atk", "def", "spe", "spAtk", "spDef"];
const INTERNAL = new Map(Object.entries(tables.species3 as Record<string, number>).map(([index, national]) => [national, Number(index)]));

export interface Mon3Spec {
  /** National Dex number — the builder converts it to the game's internal index */
  species: number;
  /** Write this internal index as-is instead (for testing unknown indexes) */
  internalIndex?: number;
  pid?: number;
  tid?: number;
  sid?: number;
  shiny?: boolean;
  exp?: number;
  item?: number;
  friendship?: number;
  evs?: Partial<Record<StatKey, number>>;
  ivs?: Partial<Record<StatKey, number>>;
  moves?: number[];
  isEgg?: boolean;
  abilitySlot?: 0 | 1;
  nickname?: string;
  otName?: string;
  originGame?: number;
  metLocation?: number;
  metLevel?: number;
  ball?: number;
  language?: number;
  /** Party records only */
  level?: number;
}

const DEFAULT_TID = 12345;
const DEFAULT_SID = 54321;

function put16(b: Uint8Array, at: number, v: number) { b[at] = v & 0xff; b[at + 1] = (v >>> 8) & 0xff; }
function put32(b: Uint8Array, at: number, v: number) { put16(b, at, v & 0xffff); put16(b, at + 2, v >>> 16); }

/** Checksum → substructure shuffle → encrypt: the record as it sits in a save file. */
export function buildPk3(spec: Mon3Spec, party = false): Uint8Array {
  const p = new Uint8Array(party ? PK3_PARTY_SIZE : PK3_BOX_SIZE);
  const tid = spec.tid ?? DEFAULT_TID;
  const sid = spec.sid ?? DEFAULT_SID;
  // Default PID: substructure order 7 (so the shuffle is exercised) and not shiny
  let pid = spec.pid ?? (0x00012345 + spec.species * 0x10000) >>> 0;
  if (spec.shiny) pid = ((((tid ^ sid ^ (pid & 0xffff)) & 0xffff) << 16) | (pid & 0xffff)) >>> 0;

  put32(p, 0x00, pid);
  put32(p, 0x04, ((sid << 16) | tid) >>> 0);
  p.set(encodeText3(spec.nickname ?? (tables.species as string[])[spec.species].toUpperCase(), 10), 0x08);
  p[0x12] = spec.language ?? 2; // English
  p[0x13] = 0x02;               // has species
  p.set(encodeText3(spec.otName ?? "Tester", 7), 0x14);

  const sub = { G: new Uint8Array(12), A: new Uint8Array(12), E: new Uint8Array(12), M: new Uint8Array(12) };
  put16(sub.G, 0, spec.internalIndex ?? INTERNAL.get(spec.species)!);
  put16(sub.G, 2, spec.item ?? 0);
  put32(sub.G, 4, spec.exp ?? 0);
  sub.G[9] = spec.friendship ?? 70;
  (spec.moves ?? [33]).forEach((move, i) => { put16(sub.A, i * 2, move); sub.A[8 + i] = 35; });
  STAT_ORDER.forEach((stat, i) => { sub.E[i] = spec.evs?.[stat] ?? 0; });
  sub.M[1] = spec.metLocation ?? 16;
  put16(sub.M, 2, (spec.metLevel ?? 5) | ((spec.originGame ?? 3) << 7) | ((spec.ball ?? 4) << 11));
  let ivWord = 0;
  STAT_ORDER.forEach((stat, i) => { ivWord |= (spec.ivs?.[stat] ?? 0) << (i * 5); });
  if (spec.isEgg) ivWord |= 0x40000000;
  if (spec.abilitySlot) ivWord |= 0x80000000;
  put32(sub.M, 4, ivWord >>> 0);

  const order = SUBSTRUCTURE_ORDERS[pid % 24];
  Array.from(order).forEach((letter, i) => p.set(sub[letter as keyof typeof sub], 0x20 + i * 12));
  put16(p, 0x1c, checksum3(p.subarray(0x20, 0x50)));
  crypt3(p);
  if (party) p[0x54] = spec.level ?? 1;
  return p;
}

export interface Save3Spec {
  family?: Gen3Family;
  trainerName?: string;
  tid?: number;
  sid?: number;
  saveIndex?: number;
  party?: Mon3Spec[];
  /** "box:slot" (both 0-based) → Pokémon */
  boxes?: Record<string, Mon3Spec>;
  boxNames?: string[];
  /** How far the section order is rotated within each block */
  rotation?: number;
  /** Emerald's security key (ignored for FRLG) */
  securityKey?: number;
  /** Flip a byte in the newest block after checksumming, so only the older block validates */
  damageNewest?: boolean;
  /** Event flags to set: `offset` of the flags in SaveBlock1, and the flag ids (lib/save/progress.ts) */
  flags?: { offset: number; ids: number[] };
  playTime?: [number, number, number];
}

export function buildSave3(spec: Save3Spec = {}): Uint8Array {
  const family = spec.family ?? "rse";
  const tid = spec.tid ?? DEFAULT_TID;
  const sid = spec.sid ?? DEFAULT_SID;
  const saveIndex = spec.saveIndex ?? 10;
  const own = (m: Mon3Spec): Mon3Spec => ({ tid, sid, ...m });
  const bytes = new Uint8Array(GBA_SAVE_SIZE);

  const writeBlock = (base: number, index: number, boxes: Record<string, Mon3Spec>, party: Mon3Spec[]) => {
    const data = Array.from({ length: SECTIONS_PER_BLOCK }, () => new Uint8Array(SECTION_SIZE));
    data[0].set(encodeText3(spec.trainerName ?? "Tester", 7), 0x00);
    put16(data[0], 0x0a, tid);
    put16(data[0], 0x0c, sid);
    put32(data[0], 0xac, family === "frlg" ? 1 : spec.securityKey ?? 0);
    if (spec.playTime) {
      put16(data[0], 0x0e, spec.playTime[0]);
      data[0][0x10] = spec.playTime[1];
      data[0][0x11] = spec.playTime[2];
    }
    if (spec.flags) {
      // SaveBlock1 runs across sections 1–4
      const block1 = new Uint8Array(Array.from({ length: 4 }, (_, i) => sectionDataSize(1 + i)).reduce((a, b) => a + b, 0));
      for (const id of spec.flags.ids) block1[spec.flags.offset + (id >> 3)] |= 1 << (id & 7);
      let at = 0;
      for (let id = 1; id <= 4; id++) {
        data[id].set(block1.subarray(at, at + sectionDataSize(id)));
        at += sectionDataSize(id);
      }
    }

    const team = TEAM_OFFSETS[family];
    put32(data[1], team.count, party.length);
    party.forEach((m, i) => data[1].set(buildPk3(own(m), true), team.data + i * PK3_PARTY_SIZE));

    const pc = new Uint8Array(Array.from({ length: 9 }, (_, i) => sectionDataSize(5 + i)).reduce((a, b) => a + b, 0));
    for (const [key, m] of Object.entries(boxes)) {
      const [box, slot] = key.split(":").map(Number);
      pc.set(buildPk3(own(m)), 0x0004 + (box * 30 + slot) * PK3_BOX_SIZE);
    }
    for (let box = 0; box < 14; box++) pc.set(encodeText3(spec.boxNames?.[box] ?? `BOX ${box + 1}`, 9), 0x8344 + box * 9);
    let taken = 0;
    for (let id = 5; id <= 13; id++) {
      data[id].set(pc.subarray(taken, taken + sectionDataSize(id)));
      taken += sectionDataSize(id);
    }

    for (let id = 0; id < SECTIONS_PER_BLOCK; id++) {
      const at = base + ((id + (spec.rotation ?? 0)) % SECTIONS_PER_BLOCK) * SECTION_SIZE;
      bytes.set(data[id], at);
      put16(bytes, at + 0xff4, id);
      put16(bytes, at + 0xff6, sectionChecksum(bytes, at, sectionDataSize(id)));
      put32(bytes, at + 0xff8, SECTION_SIGNATURE);
      put32(bytes, at + 0xffc, index);
    }
  };

  // Block A is the previous save (only the party's first member, empty PC); block B the current one
  writeBlock(0, saveIndex - 1, {}, (spec.party ?? []).slice(0, 1));
  writeBlock(SECTION_SIZE * SECTIONS_PER_BLOCK, saveIndex, spec.boxes ?? {}, spec.party ?? []);
  if (spec.damageNewest) bytes[SECTION_SIZE * SECTIONS_PER_BLOCK + 0x40] ^= 0xff;
  return bytes;
}
