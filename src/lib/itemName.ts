import { LIMITS } from "./limits";

/**
 * Normalises a user-given item name: drops control characters, collapses whitespace,
 * trims and caps the length. Returns undefined for "no name" (the default name is shown).
 */
export function cleanItemName(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  const chars = Array.from(s); // don't cut surrogate pairs in half
  return chars.length > LIMITS.map.maxItemNameLength ? chars.slice(0, LIMITS.map.maxItemNameLength).join("").trimEnd() : s;
}
