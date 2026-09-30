// Image validation shared by the browser (early feedback) and the server (authoritative).
// Everything here works on raw bytes - file names and client-reported MIME types are never trusted.
import { ALLOWED_UPLOAD_TYPES, LIMITS } from "./limits";

export type AllowedType = (typeof ALLOWED_UPLOAD_TYPES)[number];

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Detects the real image type from the first bytes. Returns null when not an allowed image. */
export function sniffImageType(bytes: Uint8Array): AllowedType | null {
  const b = bytes;
  if (b.length >= 24 && PNG_SIG.every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 10 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return "image/gif";
  if (b.length >= 30 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  const head = new TextDecoder().decode(b.subarray(0, 4096)).replace(/^﻿/, "").trimStart().toLowerCase();
  if ((head.startsWith("<?xml") || head.startsWith("<svg") || head.startsWith("<!--") || head.startsWith("<!doctype svg")) && head.includes("<svg")) {
    return "image/svg+xml";
  }
  return null;
}

/** Pixel size read from the raster header, or null when the header is missing / corrupt. */
export function rasterSize(b: Uint8Array, type: AllowedType): { width: number; height: number } | null {
  switch (type) {
    case "image/png":
      // First chunk must be IHDR (length 13).
      if (u32be(b, 8) !== 13 || ascii(b, 12, 4) !== "IHDR") return null;
      return { width: u32be(b, 16), height: u32be(b, 20) };
    case "image/gif":
      return { width: u16le(b, 6), height: u16le(b, 8) };
    case "image/webp": {
      const chunk = ascii(b, 12, 4);
      if (chunk === "VP8 " && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
        return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
      }
      if (chunk === "VP8L" && b.length >= 25 && b[20] === 0x2f) {
        const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24];
        return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
      }
      if (chunk === "VP8X" && b.length >= 30) return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
      return null;
    }
    case "image/jpeg": {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null;
        const m = b[i + 1];
        if (m === 0xff) {
          i++; // fill byte
          continue;
        }
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
          i += 2;
          continue;
        }
        if (m === 0xd9 || m === 0xda) return null; // end / start of scan before any frame header
        const len = u16be(b, i + 2);
        if (len < 2) return null;
        // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC).
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { width: u16be(b, i + 7), height: u16be(b, i + 5) };
        }
        i += 2 + len;
      }
      return null;
    }
    default:
      return null;
  }
}

export type ImageCheckError = "badType" | "corrupt" | "tooLarge" | "dimensions" | "unsafeSvg";

export type CheckedImage = { type: AllowedType; bytes: Uint8Array; width: number; height: number };

/**
 * Full validation of one image: real type, size, readable header, sane dimensions, SVG clean-up.
 * Returns the (possibly sanitised) bytes to store.
 */
export function checkImage(input: Uint8Array, maxBytes: number = LIMITS.user.maxUploadBytes): { ok: true; image: CheckedImage } | { ok: false; error: ImageCheckError } {
  if (input.length === 0) return { ok: false, error: "corrupt" };
  if (input.length > maxBytes) return { ok: false, error: "tooLarge" };
  const type = sniffImageType(input);
  if (!type || !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(type)) return { ok: false, error: "badType" };

  let bytes = input;
  let size: { width: number; height: number } | null;
  if (type === "image/svg+xml") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(input);
    } catch {
      return { ok: false, error: "corrupt" };
    }
    const cleaned = sanitizeSvg(text);
    if (cleaned === null) return { ok: false, error: "unsafeSvg" };
    bytes = new TextEncoder().encode(cleaned);
    size = svgSize(cleaned) ?? { width: 256, height: 256 };
    // Vector: intrinsic size is only a default placement size, so clamp instead of rejecting.
    const k = Math.min(1, LIMITS.files.maxImageSide / Math.max(size.width, size.height));
    size = { width: Math.max(1, Math.round(size.width * k)), height: Math.max(1, Math.round(size.height * k)) };
  } else {
    size = rasterSize(input, type);
    if (!size || !size.width || !size.height) return { ok: false, error: "corrupt" };
    if (
      size.width > LIMITS.files.maxImageSide ||
      size.height > LIMITS.files.maxImageSide ||
      size.width * size.height > LIMITS.files.maxImagePixels
    ) {
      return { ok: false, error: "dimensions" };
    }
  }
  return { ok: true, image: { type, bytes, width: Math.round(size.width), height: Math.round(size.height) } };
}

/**
 * Defensive clean-up of user SVGs. Uploaded SVGs are only ever rendered through <image> / <img>
 * (where scripts never run) and served with a sandboxing CSP, this is an extra layer.
 * Returns null for documents that must be rejected outright (DTD / entity tricks, no <svg> root).
 */
export function sanitizeSvg(svg: string): string | null {
  // Internal DTD subsets enable entity expansion ("billion laughs") and external entity tricks.
  if (/<!ENTITY/i.test(svg) || /<!DOCTYPE[^>]*\[/i.test(svg)) return null;
  let out = svg;
  for (let pass = 0; pass < 5; pass++) {
    const before = out;
    out = out
      .replace(/<(script|foreignObject|iframe|embed|object|handler|listener|audio|video)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<(script|foreignObject|iframe|embed|object|handler|listener|audio|video)\b[^>]*\/?>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(?:href|xlink:href|src|from|to|values|by)\s*=\s*("|')\s*(?:javascript|vbscript|data:text\/html)[^"']*\1/gi, "")
      .replace(/<\?xml-stylesheet[^>]*\?>/gi, "")
      .replace(/@import[^;]*;?/gi, "")
      .replace(/expression\s*\(/gi, "(");
    if (out === before) break;
  }
  if (!/<svg[\s>]/i.test(out)) return null;
  return out;
}

/** Best-effort intrinsic size of an SVG from width/height or viewBox. */
export function svgSize(svg: string): { width: number; height: number } | null {
  const tag = svg.match(/<svg[^>]*>/i)?.[0];
  if (!tag) return null;
  const attr = (n: string) => tag.match(new RegExp(`\\s${n}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  const w = parseFloat(attr("width") ?? "");
  const h = parseFloat(attr("height") ?? "");
  if (w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h) && !/%/.test(attr("width") ?? "")) return { width: w, height: h };
  const vb = attr("viewBox")?.split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0 && Number.isFinite(vb[2]) && Number.isFinite(vb[3])) return { width: vb[2], height: vb[3] };
  return null;
}
