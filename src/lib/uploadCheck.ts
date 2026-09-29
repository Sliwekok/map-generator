// Upload validation shared by the browser (anonymous uploads) and the server.
import { ALLOWED_UPLOAD_TYPES } from "./limits";

export type AllowedType = (typeof ALLOWED_UPLOAD_TYPES)[number];

/** Detects the real image type from the first bytes. Returns null when not an allowed image. */
export function sniffImageType(bytes: Uint8Array): AllowedType | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  const head = new TextDecoder().decode(b.slice(0, 2048)).replace(/^﻿/, "").trimStart().toLowerCase();
  if ((head.startsWith("<?xml") || head.startsWith("<svg") || head.startsWith("<!--") || head.startsWith("<!doctype svg")) && head.includes("<svg")) {
    return "image/svg+xml";
  }
  return null;
}

/**
 * Defensive clean-up of user SVGs. Uploaded SVGs are only ever rendered through <image>
 * (where scripts never run) and served with a sandboxing CSP, this is an extra layer.
 */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "")
    .replace(/<!ENTITY[^>]*>/gi, "");
}

/** Best-effort intrinsic size of an SVG from width/height or viewBox. */
export function svgSize(svg: string): { width: number; height: number } | null {
  const tag = svg.match(/<svg[^>]*>/i)?.[0];
  if (!tag) return null;
  const attr = (n: string) => tag.match(new RegExp(`\\s${n}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  const w = parseFloat(attr("width") ?? "");
  const h = parseFloat(attr("height") ?? "");
  if (w > 0 && h > 0 && !/%/.test(attr("width") ?? "")) return { width: w, height: h };
  const vb = attr("viewBox")?.split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { width: vb[2], height: vb[3] };
  return null;
}
