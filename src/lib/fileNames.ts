// File / folder name rules shared by the browser (instant feedback) and the server (authoritative).
import { LIMITS } from "./limits";
import type { AllowedType } from "./uploadCheck";

export type NameError = "empty" | "tooLong" | "invalidChars" | "reserved" | "dots";

// Path separators, characters Windows forbids, control characters and invisible /
// bidirectional-override characters (used to disguise extensions, e.g. "gnp.exe" shown as "exe.png").
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/;
const FORBIDDEN_G = /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

/** Unicode NFC, whitespace collapsed to single spaces, trimmed. */
export function normalizeName(raw: string): string {
  return String(raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Case-insensitive key used to detect duplicate names inside one folder. */
export const nameKey = (name: string) => normalizeName(name).toLowerCase();

export function validateName(raw: unknown): { ok: true; name: string } | { ok: false; error: NameError } {
  if (typeof raw !== "string") return { ok: false, error: "empty" };
  const name = normalizeName(raw);
  if (!name) return { ok: false, error: "empty" };
  if ([...name].length > LIMITS.files.maxNameLength) return { ok: false, error: "tooLong" };
  if (FORBIDDEN.test(name)) return { ok: false, error: "invalidChars" };
  if (/^\.+$/.test(name) || name.endsWith(".")) return { ok: false, error: "dots" };
  if (RESERVED.test(name)) return { ok: false, error: "reserved" };
  return { ok: true, name };
}

/** Splits "a.b.png" into ["a.b", ".png"]; a leading dot is not an extension. */
export function splitExt(name: string): [string, string] {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return [name, ""];
  return [name.slice(0, i), name.slice(i)];
}

function truncate(name: string, max: number): string {
  const chars = [...name];
  if (chars.length <= max) return name;
  const [base, ext] = splitExt(name);
  const extChars = [...ext];
  if (extChars.length >= max - 1) return chars.slice(0, max).join("");
  return [...base].slice(0, max - extChars.length).join("").trimEnd() + ext;
}

/**
 * Turns an untrusted name (archive entry, OS file name) into a valid one:
 * forbidden characters become "_", trailing dots are dropped, it is shortened keeping the extension.
 */
export function sanitizeName(raw: string, fallback = "file"): string {
  let name = normalizeName(String(raw ?? "").replace(FORBIDDEN_G, "_"));
  name = name.replace(/[.\s]+$/, "");
  if (!name || /^[._\s]+$/.test(name)) name = fallback;
  if (RESERVED.test(name)) name = `_${name}`;
  name = truncate(name, LIMITS.files.maxNameLength);
  const v = validateName(name);
  return v.ok ? v.name : fallback;
}

/** Returns `name`, or "name (2).ext", "name (3).ext"… - the first one whose key is not in `taken`. */
export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(nameKey(name))) return name;
  const [base, ext] = splitExt(name);
  const cleanBase = base.replace(/ \(\d+\)$/, "");
  for (let i = 2; i < 10000; i++) {
    const candidate = truncate(`${cleanBase} (${i})${ext}`, LIMITS.files.maxNameLength);
    if (!taken.has(nameKey(candidate))) return candidate;
  }
  return truncate(`${cleanBase} (${Date.now()})${ext}`, LIMITS.files.maxNameLength);
}

export const IMAGE_EXTENSIONS: Record<AllowedType, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg", ".jpe", ".jfif"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/svg+xml": [".svg"],
};

const IMAGE_EXT_LIST = Object.values(IMAGE_EXTENSIONS).flat();
export const ARCHIVE_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".tgz"];

/** `accept` attribute for the upload file picker. */
export const UPLOAD_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  ...IMAGE_EXT_LIST,
  ".zip",
  ".tar",
  ".gz",
  ".tgz",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-tar",
  "application/gzip",
].join(",");

export function fileKind(name: string): "image" | "archive" | null {
  const lower = name.toLowerCase();
  if (ARCHIVE_EXTENSIONS.some((e) => lower.endsWith(e))) return "archive";
  const [, ext] = splitExt(lower);
  if (IMAGE_EXT_LIST.includes(ext)) return "image";
  return null;
}

/** Makes sure the name ends with an extension that matches the real (sniffed) type. */
export function withTypeExtension(name: string, type: AllowedType): string {
  const [base, ext] = splitExt(name);
  if (IMAGE_EXTENSIONS[type].includes(ext.toLowerCase())) return name;
  // "photo.png" that is really a JPEG becomes "photo.jpg"; "photo" becomes "photo.jpg".
  const keepBase = IMAGE_EXT_LIST.includes(ext.toLowerCase()) ? base : name;
  return truncate(`${keepBase}${IMAGE_EXTENSIONS[type][0]}`, LIMITS.files.maxNameLength);
}

/** OS / tool metadata that is silently ignored inside archives. */
export function isSystemJunk(segments: string[]): boolean {
  return segments.some(
    (s) =>
      s === "__MACOSX" ||
      s.startsWith("._") ||
      /^(\.ds_store|thumbs\.db|desktop\.ini|\.git|\.svn)$/i.test(s),
  );
}
