"use client";

import { create } from "zustand";
import { BRUSH_LINES, LAYER_ORDER } from "@/lib/types";
import { DEFAULT_BRUSH, type BrushSettings } from "./brush";

const KEY = "mf_brush";

/** Slider ranges (grid cells, or multipliers). */
export const BRUSH_LIMITS = {
  size: [0.05, 8] as [number, number],
  lineSpacing: [0.25, 4] as [number, number],
  scatterScale: [0.1, 4] as [number, number],
  scatterSpacing: [0.2, 4] as [number, number],
  scatterSpread: [0, 8] as [number, number],
  /** Graphics one scatter brush picks from. */
  scatterAssets: 12,
};

/** Brush settings are a per-browser convenience: remembered across maps, never saved in a map. */
function read(): BrushSettings {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_BRUSH;
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULT_BRUSH;
    return sanitize({ ...DEFAULT_BRUSH, ...raw });
  } catch {
    return DEFAULT_BRUSH;
  }
}

const clamp = (v: unknown, min: number, max: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const isColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v);

function sanitize(b: BrushSettings): BrushSettings {
  const d = DEFAULT_BRUSH;
  return {
    size: clamp(b.size, BRUSH_LIMITS.size[0], BRUSH_LIMITS.size[1], d.size),
    color: isColor(b.color) ? b.color : d.color,
    texture: typeof b.texture === "string" && /^[A-Za-z0-9_:-]{1,64}$/.test(b.texture) ? b.texture : null,
    textureScale: clamp(b.textureScale, 0.1, 10, d.textureScale),
    softness: clamp(b.softness, 0, 1, d.softness),
    smoothing: clamp(b.smoothing, 0, 1, d.smoothing),
    edge: typeof b.edge === "boolean" ? b.edge : d.edge,
    edgeColor: isColor(b.edgeColor) ? b.edgeColor : d.edgeColor,
    edgeWidth: clamp(b.edgeWidth, 0.01, 1, d.edgeWidth),
    opacity: clamp(b.opacity, 0.05, 1, d.opacity),
    layer: LAYER_ORDER.includes(b.layer) ? b.layer : d.layer,
    merge: typeof b.merge === "boolean" ? b.merge : d.merge,
    eraserSize: clamp(b.eraserSize, BRUSH_LIMITS.size[0], BRUSH_LIMITS.size[1], d.eraserSize),
    eraserSoftness: clamp(b.eraserSoftness, 0, 1, d.eraserSoftness),
    eraserRestore: typeof b.eraserRestore === "boolean" ? b.eraserRestore : d.eraserRestore,
    kind: b.kind === "scatter" ? "scatter" : "paint",
    line: BRUSH_LINES.includes(b.line) ? b.line : d.line,
    lineSpacing: clamp(b.lineSpacing, BRUSH_LIMITS.lineSpacing[0], BRUSH_LIMITS.lineSpacing[1], d.lineSpacing),
    accent: isColor(b.accent) ? b.accent : d.accent,
    rough: clamp(b.rough, 0, 1, d.rough),
    flipSide: typeof b.flipSide === "boolean" ? b.flipSide : d.flipSide,
    scatter: Array.isArray(b.scatter)
      ? [...new Set(b.scatter.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x)))].slice(0, BRUSH_LIMITS.scatterAssets)
      : d.scatter,
    scatterScale: clamp(b.scatterScale, BRUSH_LIMITS.scatterScale[0], BRUSH_LIMITS.scatterScale[1], d.scatterScale),
    scatterJitter: clamp(b.scatterJitter, 0, 1, d.scatterJitter),
    scatterSpacing: clamp(b.scatterSpacing, BRUSH_LIMITS.scatterSpacing[0], BRUSH_LIMITS.scatterSpacing[1], d.scatterSpacing),
    scatterSpread: clamp(b.scatterSpread, BRUSH_LIMITS.scatterSpread[0], BRUSH_LIMITS.scatterSpread[1], d.scatterSpread),
    scatterRotate: b.scatterRotate === "follow" || b.scatterRotate === "none" ? b.scatterRotate : "random",
    scatterFlip: typeof b.scatterFlip === "boolean" ? b.scatterFlip : d.scatterFlip,
    scatterLayer: b.scatterLayer === "auto" || LAYER_ORDER.includes(b.scatterLayer as never) ? b.scatterLayer : d.scatterLayer,
  };
}

interface BrushState {
  settings: BrushSettings;
  /** Preset the current settings came from (cleared by any manual change). */
  preset: string | null;
  set: (patch: Partial<BrushSettings>, preset?: string | null) => void;
  /** Multiplies the active tool's size (brush, scatter stamps or eraser) - bound to [ and ]. */
  grow: (factor: number, eraser: boolean) => void;
}

export const useBrush = create<BrushState>((set, get) => ({
  settings: DEFAULT_BRUSH,
  preset: null,
  set(patch, preset = null) {
    const settings = sanitize({ ...get().settings, ...patch });
    set({ settings, preset });
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable - settings just aren't remembered */
    }
  },
  grow(factor, eraser) {
    const s = get().settings;
    const r = (n: number) => Math.round(n * 100) / 100;
    if (eraser) get().set({ eraserSize: r(s.eraserSize * factor) }, get().preset);
    else if (s.kind === "scatter") get().set({ scatterScale: r(s.scatterScale * factor) }, get().preset);
    else get().set({ size: r(s.size * factor) }, get().preset);
  },
}));

let hydrated = false;
/** Loads remembered settings once on the client (kept out of module init so SSR stays stable). */
export function hydrateBrush() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  useBrush.setState({ settings: read() });
}
