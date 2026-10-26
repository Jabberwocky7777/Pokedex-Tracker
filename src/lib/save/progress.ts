/**
 * Game progress read from a save: badges, Hall of Fame, National Pokédex, play time.
 *
 * Offsets come from the pret decompilations (checked 2026-10-26):
 * - Gen IV: the trainer record that starts with the trainer's name —
 *   TrainerInfo in pokeplatinum include/trainer_info.h, PlayerProfile in
 *   pokediamond and pokeheartgold include/player_data.h. All three agree:
 *   name +0x00 (16 bytes), id +0x10, money +0x14, gender +0x18, language +0x19,
 *   badges +0x1A (one bit per badge id), avatar +0x1B, version +0x1C, then a
 *   byte whose bit 0 is "game clear" (set on entering the Hall of Fame) and bit
 *   1 is "has National Pokédex" (+0x1D); HG/SS keeps the Kanto badges at +0x1F.
 *   Coins (u16) follow the record at +0x20 and play time at +0x22 (u16 hours,
 *   u8 minutes, u8 seconds) — PlayerSave / PLAYERDATA in the same headers.
 * - Gen III: event flags in SaveBlock1 (sections 1–4 joined) at 0x1220 in
 *   Ruby/Sapphire (pokeruby include/global.h), 0x1270 in Emerald and 0xEE0 in
 *   FireRed/LeafGreen (pokeemerald, pokefirered include/global.h); the flag ids
 *   are FLAG_BADGE01_GET … FLAG_BADGE08_GET, FLAG_SYS_GAME_CLEAR and
 *   FLAG_SYS_NATIONAL_DEX in each include/constants/flags.h. Play time is in
 *   SaveBlock2 (section 0) at 0x0E (u16 hours), 0x10 minutes, 0x11 seconds.
 *
 * NOT VERIFIED against a real save yet. The trainer name and id these offsets
 * sit next to were checked on real Platinum and SoulSilver saves, but no real
 * save has had its badges compared with its trainer card. So nothing here is
 * used unless its family is in PROGRESS_VERIFIED — parseGen3Save / parseGen4Save
 * leave `progress` undefined otherwise, and the import review proposes nothing.
 * To verify a family: put a real save in __tests__/fixtures/ (see
 * real-save.test.ts), compare what the "progress" test prints with the game's
 * trainer card and play time, write those values into the test, and add the
 * family below.
 *
 * Hall of Fame dates are not read: the Gen IV Hall of Fame lives in a separate
 * area of the save whose record layout hasn't been checked, and Gen III only
 * keeps the teams, not the date.
 */
import type { SaveFamily } from "./types";

export interface SaveProgress {
  /** Earned badge ids (data/game-progress.ts): 0–7, and 8–15 for HG/SS Kanto */
  badges?: number[];
  hallOfFame?: boolean;
  nationalDex?: boolean;
  playTime?: { hours: number; minutes: number; seconds: number };
}

/** Families whose progress offsets have been checked against a real save. */
export const PROGRESS_VERIFIED: readonly SaveFamily[] = [];

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const bits = (byte: number, base = 0) => Array.from({ length: 8 }, (_, i) => i).filter((i) => byte & (1 << i)).map((i) => i + base);

/** Gen IV: `trainer` is the absolute offset of the trainer record (its name). */
export function readGen4Progress(bytes: Uint8Array, trainer: number, family: SaveFamily): SaveProgress {
  const flags = bytes[trainer + 0x1d];
  return {
    badges: [...bits(bytes[trainer + 0x1a]), ...(family === "hgss" ? bits(bytes[trainer + 0x1f], 8) : [])],
    hallOfFame: (flags & 1) !== 0,
    nationalDex: (flags & 2) !== 0,
    playTime: { hours: u16(bytes, trainer + 0x22), minutes: bytes[trainer + 0x24], seconds: bytes[trainer + 0x25] },
  };
}

/** Where each Gen III game keeps its flags, and which flag ids it uses */
export const GEN3_FLAGS = {
  rs:      { flags: 0x1220, badge1: 0x807, gameClear: 0x804, nationalDex: 0x836 },
  emerald: { flags: 0x1270, badge1: 0x867, gameClear: 0x864, nationalDex: 0x896 },
  frlg:    { flags: 0x0ee0, badge1: 0x820, gameClear: 0x82c, nationalDex: 0x840 },
} as const;
export type Gen3FlagGame = keyof typeof GEN3_FLAGS;

/**
 * Gen III: `block1` is SaveBlock1 (sections 1–4 joined), `block2` SaveBlock2
 * (section 0). Ruby/Sapphire and Emerald share a family but not the flag
 * offsets, so the caller says which game it is — and reads nothing when it can't tell.
 */
export function readGen3Progress(block1: Uint8Array, block2: Uint8Array, game: Gen3FlagGame): SaveProgress {
  const at = GEN3_FLAGS[game];
  const flag = (id: number) => (block1[at.flags + (id >> 3)] & (1 << (id & 7))) !== 0;
  return {
    badges: Array.from({ length: 8 }, (_, i) => i).filter((i) => flag(at.badge1 + i)),
    hallOfFame: flag(at.gameClear),
    nationalDex: flag(at.nationalDex),
    playTime: { hours: u16(block2, 0x0e), minutes: block2[0x10], seconds: block2[0x11] },
  };
}
