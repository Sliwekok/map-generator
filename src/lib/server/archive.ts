import "server-only";
// Minimal, defensive readers for ZIP, TAR and TAR.GZ archives (no third-party code).
//
// Safety properties:
//  - every offset/length is bounds-checked against the buffer, corrupt input throws ArchiveError
//  - entry count is capped before anything is decompressed
//  - decompression always has a hard output cap (zlib maxOutputLength), so lying size fields
//    and zip bombs cannot allocate more than the caller's budget
//  - ZIP entries are CRC-checked; encrypted, ZIP64, multi-disk and exotic compression are refused
//  - symlinks / hard links / devices are reported as "other" and never followed
//  - entry paths are returned raw: the caller MUST normalise them (see files.ts `entrySegments`)
import zlib from "node:zlib";

export type ArchiveErrorCode =
  | "archive_corrupt"
  | "archive_unsupported"
  | "archive_too_many_entries"
  | "archive_too_large_unpacked";

export class ArchiveError extends Error {
  constructor(public code: ArchiveErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export type EntryErrorCode = "too_large" | "corrupt";
export class EntryError extends Error {
  constructor(public code: EntryErrorCode) {
    super(code);
  }
}

export type EntryProblem = "encrypted" | "compression" | "link" | "special";

export interface ArchiveEntry {
  /** Raw path as stored in the archive (untrusted). */
  path: string;
  kind: "file" | "dir" | "other";
  /** Declared uncompressed size (untrusted for ZIP). */
  size: number;
  problem?: EntryProblem;
  /** Returns the entry bytes; throws EntryError when larger than `maxBytes` or corrupt. */
  read(maxBytes: number): Buffer;
}

export type ArchiveFormat = "zip" | "tar" | "tgz";

export function detectArchive(buf: Buffer): ArchiveFormat | null {
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && ((buf[2] === 3 && buf[3] === 4) || (buf[2] === 5 && buf[3] === 6))) return "zip";
  if (buf.length >= 18 && buf[0] === 0x1f && buf[1] === 0x8b && buf[2] === 8) return "tgz";
  if (buf.length >= 512 && isTarHeader(buf, 0)) return "tar";
  return null;
}

export interface ReadOptions {
  maxEntries: number;
  /** Cap for the decompressed tar stream of a .tar.gz. */
  maxUnpackedBytes: number;
}

export function readArchive(buf: Buffer, opts: ReadOptions): { format: ArchiveFormat; entries: ArchiveEntry[] } {
  const format = detectArchive(buf);
  if (!format) throw new ArchiveError("archive_unsupported", "unknown format");
  if (format === "zip") return { format, entries: readZip(buf, opts) };
  if (format === "tar") return { format, entries: readTar(buf, opts) };
  let tar: Buffer;
  try {
    // Headers + padding need a little room above the payload budget.
    tar = zlib.gunzipSync(buf, { maxOutputLength: opts.maxUnpackedBytes + 4 * 1024 * 1024 });
  } catch (e) {
    if (e instanceof RangeError || (e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") {
      throw new ArchiveError("archive_too_large_unpacked");
    }
    throw new ArchiveError("archive_corrupt", "gzip");
  }
  if (tar.length < 512 || !isTarHeader(tar, 0)) throw new ArchiveError("archive_unsupported", "gzip without tar");
  return { format, entries: readTar(tar, opts) };
}

// ---------------------------------------------------------------- CRC32

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------- ZIP

const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

function decodeCp437(b: Uint8Array): string {
  let s = "";
  for (const c of b) s += c < 0x80 ? String.fromCharCode(c) : CP437_HIGH[c - 0x80];
  return s;
}

function decodeZipName(raw: Uint8Array, utf8Flag: boolean, extra: Uint8Array): string {
  if (utf8Flag) return new TextDecoder().decode(raw);
  // Info-ZIP Unicode Path extra field (0x7075): version(1) crc32(4) utf8name.
  for (let i = 0; i + 4 <= extra.length; ) {
    const id = extra[i] | (extra[i + 1] << 8);
    const len = extra[i + 2] | (extra[i + 3] << 8);
    if (i + 4 + len > extra.length) break;
    if (id === 0x7075 && len > 5 && extra[i + 4] === 1) {
      const crc = (extra[i + 5] | (extra[i + 6] << 8) | (extra[i + 7] << 16) | (extra[i + 8] << 24)) >>> 0;
      if (crc === crc32(raw)) return new TextDecoder().decode(extra.subarray(i + 9, i + 4 + len));
    }
    i += 4 + len;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    return decodeCp437(raw);
  }
}

function readZip(buf: Buffer, opts: ReadOptions): ArchiveEntry[] {
  // End of central directory: 22 bytes + comment (max 65535), searched backwards.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ArchiveError("archive_corrupt", "no end of central directory");
  const disk = buf.readUInt16LE(eocd + 4);
  const cdDisk = buf.readUInt16LE(eocd + 6);
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ArchiveError("archive_unsupported", "zip64");
  if (disk !== 0 || cdDisk !== 0) throw new ArchiveError("archive_unsupported", "multi-disk");
  if (total > opts.maxEntries) throw new ArchiveError("archive_too_many_entries");
  if (cdOffset + cdSize > eocd) throw new ArchiveError("archive_corrupt", "central directory out of range");

  const entries: ArchiveEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < total; n++) {
    if (p + 46 > eocd || buf.readUInt32LE(p) !== 0x02014b50) throw new ArchiveError("archive_corrupt", "central directory entry");
    const madeBy = buf.readUInt16LE(p + 4) >> 8;
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const extAttr = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const end = p + 46 + nameLen + extraLen + commentLen;
    if (end > eocd) throw new ArchiveError("archive_corrupt", "entry name out of range");
    if (csize === 0xffffffff || usize === 0xffffffff || localOffset === 0xffffffff) throw new ArchiveError("archive_unsupported", "zip64");
    const name = decodeZipName(buf.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0, buf.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen));
    p = end;

    const unixMode = madeBy === 3 ? extAttr >>> 16 : 0;
    const fileType = unixMode & 0o170000;
    const isDir = name.endsWith("/") || name.endsWith("\\") || fileType === 0o040000 || (madeBy === 0 && (extAttr & 0x10) !== 0);
    let problem: EntryProblem | undefined;
    if (fileType === 0o120000) problem = "link";
    else if (fileType !== 0 && fileType !== 0o100000 && fileType !== 0o040000) problem = "special";
    else if (flags & 0x1) problem = "encrypted";
    else if (!isDir && method !== 0 && method !== 8) problem = "compression";

    entries.push({
      path: name,
      kind: problem === "link" || problem === "special" ? "other" : isDir ? "dir" : "file",
      size: usize,
      problem,
      read(maxBytes: number): Buffer {
        if (problem) throw new EntryError("corrupt");
        if (usize > maxBytes) throw new EntryError("too_large");
        if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) throw new EntryError("corrupt");
        const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
        if (start + csize > buf.length) throw new EntryError("corrupt");
        const data = buf.subarray(start, start + csize);
        let out: Buffer;
        if (method === 0) {
          out = data;
        } else {
          try {
            out = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, maxBytes) });
          } catch (e) {
            if (e instanceof RangeError || (e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") throw new EntryError("too_large");
            throw new EntryError("corrupt");
          }
        }
        if (out.length !== usize || crc32(out) !== crc) throw new EntryError("corrupt");
        return out;
      },
    });
  }
  return entries;
}

// ---------------------------------------------------------------- TAR

function isTarHeader(b: Buffer, off: number): boolean {
  if (off + 512 > b.length) return false;
  const stored = parseOctal(b.subarray(off + 148, off + 156));
  if (stored === null) return false;
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : b[off + i];
  return sum === stored;
}

function parseOctal(field: Uint8Array): number | null {
  if (field[0] & 0x80) return null; // base-256 (huge sizes) is not supported
  const raw = Buffer.from(field).toString("latin1");
  const nul = raw.indexOf("\0");
  const s = (nul < 0 ? raw : raw.slice(0, nul)).trim();
  if (!s) return 0;
  if (!/^[0-7]+$/.test(s)) return null;
  const n = parseInt(s, 8);
  return Number.isSafeInteger(n) ? n : null;
}

function cString(b: Uint8Array): string {
  const end = b.indexOf(0);
  const raw = end < 0 ? b : b.subarray(0, end);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    return Buffer.from(raw).toString("latin1");
  }
}

function paxPath(data: Buffer): string | null {
  // Records: "<len> key=value\n"
  let i = 0;
  let path: string | null = null;
  while (i < data.length) {
    const sp = data.indexOf(0x20, i);
    if (sp < 0) break;
    const len = parseInt(data.subarray(i, sp).toString("latin1"), 10);
    if (!Number.isSafeInteger(len) || len <= 0 || i + len > data.length) break;
    const rec = data.subarray(sp + 1, i + len - 1).toString("utf8");
    const eq = rec.indexOf("=");
    if (eq > 0 && rec.slice(0, eq) === "path") path = rec.slice(eq + 1);
    i += len;
  }
  return path;
}

function readTar(buf: Buffer, opts: ReadOptions): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  let off = 0;
  let longName: string | null = null;
  let headers = 0;
  while (off + 512 <= buf.length) {
    // End of archive: a zero block.
    if (buf.subarray(off, off + 512).every((x) => x === 0)) break;
    if (!isTarHeader(buf, off)) throw new ArchiveError("archive_corrupt", "tar header checksum");
    if (++headers > opts.maxEntries * 2 + 10) throw new ArchiveError("archive_too_many_entries");
    const size = parseOctal(buf.subarray(off + 124, off + 136));
    if (size === null) throw new ArchiveError("archive_unsupported", "tar size");
    const type = String.fromCharCode(buf[off + 156] || 0x30);
    const dataStart = off + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > buf.length) throw new ArchiveError("archive_corrupt", "tar entry out of range");
    const next = dataStart + Math.ceil(size / 512) * 512;

    if (type === "x" || type === "L") {
      if (size > 64 * 1024) throw new ArchiveError("archive_unsupported", "tar extended header too large");
      const data = buf.subarray(dataStart, dataEnd);
      longName = type === "L" ? cString(data) : paxPath(data) ?? longName;
      off = next;
      continue;
    }
    if (type === "g" || type === "V") {
      off = next;
      continue;
    }

    let name = cString(buf.subarray(off, off + 100));
    const magic = buf.subarray(off + 257, off + 262).toString("latin1");
    if (magic === "ustar") {
      const prefix = cString(buf.subarray(off + 345, off + 500));
      if (prefix) name = `${prefix}/${name}`;
    }
    if (longName !== null) name = longName;
    longName = null;

    const kind: ArchiveEntry["kind"] = type === "0" || type === "7" ? "file" : type === "5" ? "dir" : "other";
    const problem: EntryProblem | undefined = type === "1" || type === "2" ? "link" : kind === "other" ? "special" : undefined;
    if (entries.length >= opts.maxEntries) throw new ArchiveError("archive_too_many_entries");
    entries.push({
      path: name,
      kind: kind === "file" && name.endsWith("/") ? "dir" : kind,
      size,
      problem,
      read(maxBytes: number): Buffer {
        if (kind !== "file") throw new EntryError("corrupt");
        if (size > maxBytes) throw new EntryError("too_large");
        return buf.subarray(dataStart, dataEnd);
      },
    });
    off = next;
  }
  return entries;
}
