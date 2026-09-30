"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MapRenderer, type RenderLookups } from "@/components/map/MapRenderer";
import type { MapContent } from "@/lib/types";
import { sanitizeMapContent } from "@/lib/mapContent";
import { uploadAsDataUrl } from "@/lib/client/uploads";

export const MAX_CANVAS_SIDE = 16384;
export const MAX_CANVAS_AREA = 16384 * 8192;

function usedUploadIds(doc: MapContent): string[] {
  const ids = new Set<string>();
  for (const e of doc.elements) if (e.type === "asset" && e.assetId.startsWith("u:")) ids.add(e.assetId.slice(2));
  return [...ids];
}

async function inlineUploads(doc: MapContent): Promise<Record<string, { url: string } | null>> {
  const out: Record<string, { url: string } | null> = {};
  await Promise.all(
    usedUploadIds(doc).map(async (id) => {
      // Exports are self-contained: images that can't be embedded become placeholders.
      out[id] = await uploadAsDataUrl(id).then((url) => (url ? { url } : null));
    }),
  );
  return out;
}

/** Serialises the map to a standalone SVG document (uploads are embedded as data URLs). */
export async function buildSvg(doc: MapContent, lookups: Omit<RenderLookups, "uploads">, includeGrid: boolean): Promise<string> {
  const uploads = await inlineUploads(doc);
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => {
    root.render(
      createElement(
        "svg",
        { xmlns: "http://www.w3.org/2000/svg", width: doc.width, height: doc.height, viewBox: `0 0 ${doc.width} ${doc.height}` },
        createElement(MapRenderer, { doc, idPrefix: "x", showGrid: includeGrid, ...lookups, uploads }),
      ),
    );
  });
  const markup = host.innerHTML;
  root.unmount();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}

export type RasterType = "image/png" | "image/jpeg" | "image/webp";

/** Thrown when the browser cannot encode the requested format (e.g. older Safari with WebP). */
export class UnsupportedFormatError extends Error {}

export async function rasterize(svg: string, w: number, h: number, scale: number, type: RasterType): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    if (type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, 0.92),
    );
    // Browsers without an encoder for the type silently fall back to PNG.
    if (blob.type !== type) throw new UnsupportedFormatError(type);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface ProjectFile {
  format: "mapforge";
  version: 1;
  exportedAt: string;
  map: MapContent;
  uploads: Record<string, { name: string; dataUrl: string }>;
}

export async function buildProject(doc: MapContent, names: Record<string, string>): Promise<ProjectFile> {
  const uploads: ProjectFile["uploads"] = {};
  const inl = await inlineUploads(doc);
  for (const [id, v] of Object.entries(inl)) if (v) uploads[id] = { name: names[id] ?? `${id}.img`, dataUrl: v.url };
  return { format: "mapforge", version: 1, exportedAt: new Date().toISOString(), map: doc, uploads };
}

export function parseProject(text: string): ProjectFile {
  const raw = JSON.parse(text);
  if (raw?.format !== "mapforge" || !raw.map) throw new Error("invalid");
  const uploads: ProjectFile["uploads"] = {};
  for (const [id, v] of Object.entries((raw.uploads ?? {}) as Record<string, { name?: string; dataUrl?: string }>)) {
    if (typeof v?.dataUrl === "string" && v.dataUrl.startsWith("data:image/")) uploads[id] = { name: String(v.name ?? id), dataUrl: v.dataUrl };
  }
  return { format: "mapforge", version: 1, exportedAt: String(raw.exportedAt ?? ""), map: sanitizeMapContent(raw.map), uploads };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(name: string) {
  return (name || "map").replace(/[^\p{L}\p{N}_\- ]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 60) || "map";
}
