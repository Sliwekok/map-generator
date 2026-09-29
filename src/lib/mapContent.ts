import {
  LAYER_ORDER,
  type BackgroundSettings,
  type GridSettings,
  type LayerId,
  type LayerState,
  type MapContent,
  type MapElement,
} from "./types";
import { DEFAULT_GRID_SIZE, LIMITS } from "./limits";

export function defaultLayers(): LayerState[] {
  return LAYER_ORDER.map((id) => ({ id, visible: true, locked: false }));
}

export function defaultGrid(enabled = true, size = DEFAULT_GRID_SIZE): GridSettings {
  return { enabled, size, color: "#000000", opacity: 0.35, lineWidth: 1, style: "lines" };
}

export function defaultBackground(): BackgroundSettings {
  return { color: "#e8dcc0", pattern: null, patternScale: 1 };
}

export function createMapContent(opts: {
  name: string;
  width: number;
  height: number;
  grid?: Partial<GridSettings>;
  background?: Partial<BackgroundSettings>;
}): MapContent {
  return {
    name: opts.name,
    width: clampInt(opts.width, LIMITS.map.minSize, LIMITS.map.maxSize, 1400),
    height: clampInt(opts.height, LIMITS.map.minSize, LIMITS.map.maxSize, 1050),
    background: { ...defaultBackground(), ...opts.background },
    grid: { ...defaultGrid(), ...opts.grid },
    layers: defaultLayers(),
    elements: [],
  };
}

// ---------------------------------------------------------------------------
// Validation / sanitisation of untrusted input (used by the API and by JSON import)
// ---------------------------------------------------------------------------

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|none|transparent)$/;
const ID_RE = /^[A-Za-z0-9_:-]{1,64}$/;

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return Math.round(num(v, min, max, fallback));
}

function color(v: unknown, fallback: string): string {
  return typeof v === "string" && COLOR_RE.test(v) ? v : fallback;
}

function str(v: unknown, max: number, fallback = ""): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}

function layer(v: unknown, fallback: LayerId): LayerId {
  return LAYER_ORDER.includes(v as LayerId) ? (v as LayerId) : fallback;
}

const BIG = 100000;

function sanitizeElement(raw: unknown): MapElement | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !ID_RE.test(r.id)) return null;
  const base = {
    id: r.id,
    x: num(r.x, -BIG, BIG, 0),
    y: num(r.y, -BIG, BIG, 0),
    width: num(r.width, 1, BIG, 10),
    height: num(r.height, 1, BIG, 10),
    rotation: num(r.rotation, -360, 360, 0),
    opacity: num(r.opacity, 0, 1, 1),
    layer: layer(r.layer, "objects"),
    locked: r.locked === true || undefined,
    flipX: r.flipX === true || undefined,
    flipY: r.flipY === true || undefined,
  };
  switch (r.type) {
    case "asset": {
      if (typeof r.assetId !== "string" || !ID_RE.test(r.assetId)) return null;
      return {
        ...base,
        type: "asset",
        assetId: r.assetId,
        tint: r.tint ? color(r.tint, "#000000") : undefined,
      };
    }
    case "rect":
    case "ellipse":
      return {
        ...base,
        type: r.type,
        fill: color(r.fill, "#8b5a2b"),
        fillOpacity: num(r.fillOpacity, 0, 1, 1),
        stroke: color(r.stroke, "#000000"),
        strokeWidth: num(r.strokeWidth, 0, 200, 2),
        radius: r.type === "rect" ? num(r.radius, 0, BIG, 0) : undefined,
      };
    case "text": {
      const ff = r.fontFamily;
      return {
        ...base,
        type: "text",
        text: str(r.text, 1000, "Text"),
        fontSize: num(r.fontSize, 4, 2000, 32),
        color: color(r.color, "#1f1a14"),
        fontFamily: ff === "sans" || ff === "mono" || ff === "fantasy" ? ff : "serif",
        bold: r.bold === true || undefined,
        italic: r.italic === true || undefined,
        outline: r.outline ? color(r.outline, "#ffffff") : null,
      };
    }
    case "path": {
      if (!Array.isArray(r.points)) return null;
      const points: [number, number][] = [];
      for (const p of r.points.slice(0, 4000)) {
        if (Array.isArray(p) && p.length === 2) {
          points.push([num(p[0], -BIG, BIG, 0), num(p[1], -BIG, BIG, 0)]);
        }
      }
      if (points.length < 2) return null;
      return {
        ...base,
        type: "path",
        points,
        stroke: color(r.stroke, "#3b2f23"),
        strokeWidth: num(r.strokeWidth, 0.5, 500, 6),
        closed: r.closed === true || undefined,
        fill: r.fill ? color(r.fill, "none") : null,
      };
    }
    default:
      return null;
  }
}

/** Returns a clean MapContent or throws an Error with a message. */
export function sanitizeMapContent(raw: unknown): MapContent {
  if (!raw || typeof raw !== "object") throw new Error("Invalid map payload");
  const r = raw as Record<string, unknown>;
  const g = (r.grid ?? {}) as Record<string, unknown>;
  const b = (r.background ?? {}) as Record<string, unknown>;
  const elementsRaw = Array.isArray(r.elements) ? r.elements : [];
  if (elementsRaw.length > LIMITS.map.maxElements) {
    throw new Error(`Too many elements (max ${LIMITS.map.maxElements})`);
  }
  const seen = new Set<string>();
  const elements: MapElement[] = [];
  for (const e of elementsRaw) {
    const el = sanitizeElement(e);
    if (el && !seen.has(el.id)) {
      seen.add(el.id);
      elements.push(el);
    }
  }
  const layersRaw = Array.isArray(r.layers) ? (r.layers as Record<string, unknown>[]) : [];
  const layers: LayerState[] = LAYER_ORDER.map((id) => {
    const found = layersRaw.find((l) => l && l.id === id);
    return { id, visible: found ? found.visible !== false : true, locked: found ? found.locked === true : false };
  });
  return {
    name: str(r.name, LIMITS.map.maxNameLength, "Untitled map").trim() || "Untitled map",
    width: clampInt(r.width, LIMITS.map.minSize, LIMITS.map.maxSize, 1400),
    height: clampInt(r.height, LIMITS.map.minSize, LIMITS.map.maxSize, 1050),
    grid: {
      enabled: g.enabled !== false,
      size: num(g.size, 8, 1000, DEFAULT_GRID_SIZE),
      color: color(g.color, "#000000"),
      opacity: num(g.opacity, 0, 1, 0.35),
      lineWidth: num(g.lineWidth, 0.25, 20, 1),
      style: g.style === "dots" ? "dots" : "lines",
    },
    background: {
      color: color(b.color, "#e8dcc0"),
      pattern: typeof b.pattern === "string" && ID_RE.test(b.pattern) ? b.pattern : null,
      patternScale: num(b.patternScale, 0.1, 20, 1),
    },
    layers,
    elements,
  };
}
