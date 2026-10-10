import { GBA_SAVE_SIZE, parseGen3Save } from "./gen3";
import { parseGen4Save, SAVE_SIZE } from "./gen4";
import { SaveParseError, type ParsedSave } from "./types";

/**
 * Reads any supported save dump, picking the format by file size:
 * 512 KB is a DS (Gen IV) save, 128 KB a Game Boy Advance (Gen III) one.
 * Throws SaveParseError with a message fit to show the user.
 */
export function parseSave(bytes: Uint8Array): ParsedSave {
  if (bytes.length >= SAVE_SIZE) return parseGen4Save(bytes);
  if (bytes.length >= GBA_SAVE_SIZE) return parseGen3Save(bytes);
  throw new SaveParseError(
    "This file is too small to be a save. DS saves (Diamond, Pearl, Platinum, HeartGold, SoulSilver) are 512 KB and " +
    "Game Boy Advance saves (Ruby, Sapphire, Emerald, FireRed, LeafGreen) are 128 KB — .nds and .gba files are the games themselves.",
  );
}
