// Brush painting helpers: element creation, merging passes, erasing, smoothing and the
// curve used to draw strokes. Everything here is pure (no store / DOM access).

import type { BrushElement, BrushLine, BrushOp, LayerId, MapContent, MapElement } from "@/lib/types";
import { LIMITS } from "@/lib/limits";
import { center, rotatePt, simplify, type Box, type Pt } from "./geometry";
import { newId } from "./store";
import { featherOf } from "./brushShape";
import { lineTakesAccent, lineTakesEdge, lineTakesSpacing, lineTakesTexture, roughGrowth } from "./brushLines";

export { featherOf, mainSize, smoothD } from "./brushShape";

export type ScatterRotate = "random" | "follow" | "none";

/** Brush settings as the painter UI keeps them (sizes are in grid cells, so they suit any map). */
export interface BrushSettings {
  /** Paint a band of colour / texture, or scatter library graphics along the stroke. */
  kind: "paint" | "scatter";
  size: number; // cells
  color: string;
  texture: string | null; // pattern id or "u:<uploadId>"
  textureScale: number; // tile = cells
  softness: number; // 0..1
  smoothing: number; // 0..1
  edge: boolean;
  edgeColor: string;
  edgeWidth: number; // cells
  opacity: number;
  layer: LayerId;
  merge: boolean; // continue a stroke of the same brush instead of starting a new item
  eraserSize: number; // cells
  /** Soft edge of the eraser on images / graphics (0..1). */
  eraserSoftness: number;
  /** The eraser paints erased parts of the selected graphics back instead of erasing. */
  eraserRestore: boolean;
  // Line style (paint brush)
  line: BrushLine;
  lineSpacing: number; // gap multiplier
  accent: string; // rail ties, fence posts
  rough: number; // 0..1 organic outline (solid only)
  flipSide: boolean; // cliff hatching on the other side
  // Scatter brush
  scatter: string[]; // library asset ids, picked at random
  scatterScale: number; // × the asset's own size
  scatterJitter: number; // 0..1 size variation
  scatterSpacing: number; // gap between stamps × their size (1 = about touching)
  scatterSpread: number; // cells across the stroke
  scatterRotate: ScatterRotate;
  scatterFlip: boolean; // random mirroring
  scatterLayer: LayerId | "auto"; // auto = each graphic's own layer
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 0.6,
  color: "#3f7fb5",
  texture: null,
  textureScale: 1,
  softness: 0.0,
  smoothing: 0.0,
  edge: true,
  edgeColor: "#6b5a3e",
  edgeWidth: 0.08,
  opacity: 1,
  layer: "terrain",
  merge: true,
  eraserSize: 0.8,
  eraserSoftness: 0,
  eraserRestore: false,
  kind: "paint",
  line: "solid",
  lineSpacing: 1,
  accent: "#4a3826",
  rough: 0,
  flipSide: false,
  scatter: ["tree", "bush"],
  scatterScale: 0.6,
  scatterJitter: 0.3,
  scatterSpacing: 1,
  scatterSpread: 1.5,
  scatterRotate: "random",
  scatterFlip: true,
  scatterLayer: "auto",
};

export type PresetGroup = "areas" | "lines" | "rough" | "scatter";

export interface BrushPreset {
  id: string;
  group: PresetGroup;
  /** Tried in order: the first texture the user can use wins; otherwise the colour alone is used. */
  textures: string[];
  /** Scatter presets: the graphics the user can use are kept, the rest skipped. */
  assets?: string[];
  settings: Partial<BrushSettings>;
}

export const BRUSH_PRESETS: BrushPreset[] = [
  { id: "river", group: "areas", textures: ["p-water"], settings: { size: 0.8, color: "#3f7fb5", textureScale: 1.5, softness: 0.15, edge: true, edgeColor: "#7a6a45", edgeWidth: 0.1, layer: "terrain" } },
  { id: "stream", group: "areas", textures: ["p-water"], settings: { size: 0.3, color: "#4d8fc4", textureScale: 1, softness: 0.2, edge: true, edgeColor: "#7a6a45", edgeWidth: 0.05, layer: "terrain" } },
  { id: "road", group: "areas", textures: ["cobble"], settings: { size: 1, color: "#8d8173", textureScale: 0.5, softness: 0, edge: true, edgeColor: "#4a4238", edgeWidth: 0.06, layer: "terrain" } },
  { id: "path", group: "areas", textures: [], settings: { size: 0.45, color: "#a07d52", softness: 0.6, edge: false, layer: "terrain" } },
  { id: "lava", group: "areas", textures: ["p-lava-rock"], settings: { size: 0.9, color: "#e8590c", textureScale: 1, softness: 0.15, edge: true, edgeColor: "#2b1d16", edgeWidth: 0.1, layer: "terrain" } },
  { id: "sand", group: "areas", textures: ["p-sand"], settings: { size: 1.5, color: "#e3cf96", textureScale: 1, softness: 0.8, edge: false, layer: "terrain" } },
  { id: "grass", group: "areas", textures: ["grass"], settings: { size: 1.5, color: "#7fae4e", textureScale: 1, softness: 0.8, edge: false, layer: "terrain" } },
  { id: "snow", group: "areas", textures: ["p-snow"], settings: { size: 1.5, color: "#f1f5f9", textureScale: 1, softness: 0.8, edge: false, layer: "terrain" } },
  { id: "wall", group: "areas", textures: [], settings: { size: 0.2, color: "#3d3a36", softness: 0, edge: true, edgeColor: "#141312", edgeWidth: 0.03, layer: "objects" } },
  // Line styles
  { id: "trail", group: "lines", textures: [], settings: { line: "dashed", size: 0.14, color: "#7a5a36", lineSpacing: 1, softness: 0, edge: false, layer: "terrain" } },
  { id: "footpath", group: "lines", textures: [], settings: { line: "dotted", size: 0.12, color: "#5b4129", lineSpacing: 1.1, softness: 0, edge: false, layer: "terrain" } },
  { id: "oldRoad", group: "lines", textures: [], settings: { line: "double", size: 0.45, color: "#4a4238", softness: 0, edge: false, layer: "terrain" } },
  { id: "railway", group: "lines", textures: [], settings: { line: "rail", size: 0.5, color: "#55534f", accent: "#6b4f2f", lineSpacing: 1, softness: 0, edge: false, layer: "terrain" } },
  { id: "fence", group: "lines", textures: [], settings: { line: "fence", size: 0.28, color: "#7a5c3a", accent: "#3f2e1e", lineSpacing: 1, softness: 0, edge: false, layer: "objects" } },
  { id: "cliff", group: "lines", textures: [], settings: { line: "cliff", size: 0.6, color: "#3d3a36", lineSpacing: 1, flipSide: false, softness: 0, edge: false, layer: "terrain" } },
  // Rough outlines
  { id: "coast", group: "rough", textures: ["p-sand"], settings: { rough: 0.7, size: 1.4, color: "#e3cf96", textureScale: 1, softness: 0, edge: true, edgeColor: "#b39b6a", edgeWidth: 0.06, layer: "terrain" } },
  { id: "pond", group: "rough", textures: ["p-water"], settings: { rough: 0.5, size: 1.6, color: "#3f7fb5", textureScale: 1.5, softness: 0, edge: true, edgeColor: "#6b5a3e", edgeWidth: 0.1, layer: "terrain" } },
  { id: "caveWall", group: "rough", textures: [], settings: { rough: 0.8, size: 0.7, color: "#2b2622", softness: 0, edge: true, edgeColor: "#14110f", edgeWidth: 0.04, layer: "objects" } },
  { id: "rubble", group: "rough", textures: ["f-gravel", "cobble"], settings: { rough: 1, size: 0.9, color: "#8d8173", textureScale: 0.75, softness: 0, edge: true, edgeColor: "#4a4238", edgeWidth: 0.04, layer: "terrain" } },
  // Scatter
  { id: "forest", group: "scatter", textures: [], assets: ["tree", "p-pine", "bush"], settings: { scatterScale: 0.6, scatterJitter: 0.35, scatterSpacing: 0.75, scatterSpread: 1.5, scatterRotate: "random", scatterFlip: true } },
  { id: "pines", group: "scatter", textures: [], assets: ["p-pine", "tree"], settings: { scatterScale: 0.6, scatterJitter: 0.3, scatterSpacing: 0.7, scatterSpread: 1, scatterRotate: "random", scatterFlip: true } },
  { id: "bushes", group: "scatter", textures: [], assets: ["bush", "grass-tuft"], settings: { scatterScale: 0.8, scatterJitter: 0.35, scatterSpacing: 0.8, scatterSpread: 0.8, scatterRotate: "random", scatterFlip: true } },
  { id: "grassTufts", group: "scatter", textures: [], assets: ["grass-tuft"], settings: { scatterScale: 0.6, scatterJitter: 0.4, scatterSpacing: 1, scatterSpread: 1, scatterRotate: "random", scatterFlip: true } },
  { id: "rocks", group: "scatter", textures: [], assets: ["rock", "p-boulders"], settings: { scatterScale: 0.6, scatterJitter: 0.5, scatterSpacing: 1.3, scatterSpread: 1, scatterRotate: "random", scatterFlip: true } },
  { id: "deadwood", group: "scatter", textures: [], assets: ["p-deadtree", "p-log"], settings: { scatterScale: 0.6, scatterJitter: 0.3, scatterSpacing: 1.2, scatterSpread: 1.2, scatterRotate: "random", scatterFlip: true } },
  { id: "mushrooms", group: "scatter", textures: [], assets: ["p-mushrooms"], settings: { scatterScale: 0.5, scatterJitter: 0.4, scatterSpacing: 1.4, scatterSpread: 1, scatterRotate: "random", scatterFlip: true } },
  { id: "desert", group: "scatter", textures: [], assets: ["p-cactus", "rock"], settings: { scatterScale: 0.8, scatterJitter: 0.35, scatterSpacing: 2, scatterSpread: 2, scatterRotate: "none", scatterFlip: true } },
  { id: "clutter", group: "scatter", textures: [], assets: ["t-barrel", "t-crates", "t-sacks", "p-barrel", "p-crate"], settings: { scatterScale: 0.9, scatterJitter: 0.15, scatterSpacing: 0.9, scatterSpread: 0.4, scatterRotate: "random", scatterFlip: true } },
];

/** What a paint preset leaves at its default unless it sets it (so no style leaks between presets). */
const PAINT_RESET: Partial<BrushSettings> = { kind: "paint", line: "solid", lineSpacing: 1, rough: 0, flipSide: false };

/**
 * Settings a preset produces, given which textures / graphics the user can use. Returns null for a
 * scatter preset none of whose graphics are available.
 */
export function presetSettings(
  p: BrushPreset,
  canUse: (texture: string) => boolean,
  canUseAsset: (asset: string) => boolean = () => true,
): Partial<BrushSettings> | null {
  if (p.group === "scatter") {
    const scatter = (p.assets ?? []).filter(canUseAsset);
    return scatter.length ? { ...p.settings, kind: "scatter", scatter } : null;
  }
  return { ...PAINT_RESET, ...p.settings, texture: p.textures.find(canUse) ?? null };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const r1 = (n: number) => Math.round(n * 10) / 10;


/** How far paint of one pass reaches beyond its centre line (stroke, edge, rough outline and feathering). */
function reach(el: Pick<BrushElement, "softness" | "edge" | "edgeWidth" | "rough" | "line">, size: number): number {
  const edge = el.edge && lineTakesEdge(el.line) ? (el.edgeWidth ?? 0) : 0;
  const grow = el.line ? 0 : roughGrowth(el.rough);
  return (size / 2) * (1 + grow) + edge + featherOf(el.softness, size) / 2 + 1;
}

/** Local box of the painted (non-eraser) passes, including their reach. */
function paintBox(el: BrushElement): Box | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const op of el.ops) {
    if (op.erase) continue;
    const m = reach(el, op.size);
    for (const [x, y] of op.points) {
      x1 = Math.min(x1, x - m);
      y1 = Math.min(y1, y - m);
      x2 = Math.max(x2, x + m);
      y2 = Math.max(y2, y + m);
    }
  }
  return x1 === Infinity ? null : { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

const shiftOps = (ops: BrushOp[], dx: number, dy: number): BrushOp[] =>
  dx || dy ? ops.map((o) => ({ ...o, points: o.points.map(([x, y]) => [r1(x + dx), r1(y + dy)] as [number, number]) })) : ops;

/**
 * Recomputes the element box after its passes or style changed, without moving any paint.
 * Unrotated, unflipped elements get a tight box; others grow symmetrically around their
 * centre so the rotation / flip pivot stays where it is.
 */
export function fitBrushBox(el: BrushElement): BrushElement {
  const b = paintBox(el);
  if (!b) return el;
  if (!el.rotation && !el.flipX && !el.flipY) {
    return { ...el, x: el.x + b.x, y: el.y + b.y, width: Math.max(2, b.width), height: Math.max(2, b.height), ops: shiftOps(el.ops, -b.x, -b.y) };
  }
  const cx = el.width / 2;
  const cy = el.height / 2;
  const hx = Math.max(1, cx - b.x, b.x + b.width - cx);
  const hy = Math.max(1, cy - b.y, b.y + b.height - cy);
  return { ...el, x: el.x + cx - hx, y: el.y + cy - hy, width: hx * 2, height: hy * 2, ops: shiftOps(el.ops, hx - cx, hy - cy) };
}

/** Converts a map point into the element's local (un-rotated, un-flipped) coordinates. */
export function toLocal(el: MapElement, p: Pt): Pt {
  const c = center(el);
  const q = el.rotation ? rotatePt(p, c, -el.rotation) : p;
  let x = q.x - el.x;
  let y = q.y - el.y;
  if (el.flipX) x = el.width - x;
  if (el.flipY) y = el.height - y;
  return { x, y };
}

export interface BrushStyle {
  color: string;
  texture: string | null;
  textureSize?: number;
  softness?: number;
  edge: string | null;
  edgeWidth?: number;
  opacity: number;
  layer: LayerId;
  line?: BrushElement["line"];
  spacing?: number;
  accent?: string | null;
  rough?: number;
  flipSide?: true;
}

/** Resolves UI settings (cells) into the pixel style stored on elements. Options a line style doesn't draw are left out. */
export function styleFrom(b: BrushSettings, grid: number): BrushStyle {
  const line = b.line === "solid" ? undefined : b.line;
  const texture = lineTakesTexture(line) ? b.texture : null;
  const edge = b.edge && lineTakesEdge(line);
  return {
    color: b.color,
    texture,
    textureSize: texture ? Math.max(2, Math.round(b.textureScale * grid * 10) / 10) : undefined,
    softness: b.softness > 0 ? b.softness : undefined,
    edge: edge ? b.edgeColor : null,
    edgeWidth: edge ? Math.max(0.5, Math.round(b.edgeWidth * grid * 10) / 10) : undefined,
    opacity: b.opacity,
    layer: b.layer,
    line,
    spacing: lineTakesSpacing(line) && Math.abs(b.lineSpacing - 1) > 0.001 ? b.lineSpacing : undefined,
    accent: lineTakesAccent(line) ? b.accent : undefined,
    rough: !line && b.rough > 0 ? b.rough : undefined,
    flipSide: line === "cliff" && b.flipSide ? true : undefined,
  };
}

export const brushPx = (cells: number, grid: number) => Math.max(1, Math.round(cells * (grid || 70) * 10) / 10);

/** A new painted element from a stroke given in map coordinates. */
export function brushElement(worldPts: [number, number][], size: number, style: BrushStyle): BrushElement {
  const el: BrushElement = {
    id: newId(),
    type: "brush",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotation: 0,
    opacity: style.opacity,
    layer: style.layer,
    ops: [{ size, points: worldPts.map(([x, y]) => [r1(x), r1(y)]) }],
    color: style.color,
    texture: style.texture,
    textureSize: style.textureSize,
    softness: style.softness,
    edge: style.edge,
    edgeWidth: style.edgeWidth,
    ...lineFields(style),
  };
  return fitBrushBox(el);
}

/** The line-style fields of a style, without undefined keys (elements stay compact). */
export function lineFields(s: Pick<BrushStyle, "line" | "spacing" | "accent" | "rough" | "flipSide">): Partial<BrushElement> {
  const out: Partial<BrushElement> = {};
  if (s.line) out.line = s.line;
  if (s.spacing !== undefined) out.spacing = s.spacing;
  if (s.accent) out.accent = s.accent;
  if (s.rough) out.rough = s.rough;
  if (s.flipSide) out.flipSide = true;
  return out;
}

/** Adds a pass (brush or eraser) given in map coordinates to an existing element. */
export function addPass(el: BrushElement, worldPts: [number, number][], size: number, erase = false): BrushElement {
  const points = worldPts.map(([x, y]) => {
    const l = toLocal(el, { x, y });
    return [r1(l.x), r1(l.y)] as [number, number];
  });
  const op: BrushOp = erase ? { erase: true, size, points } : { size, points };
  return capOps(fitBrushBox({ ...el, ops: [...el.ops, op] }));
}

/**
 * Adds an eraser stroke (map coordinates). Only the parts of the stroke that reach the
 * element are stored - one pass per run - so a long eraser drag across the map doesn't
 * copy its whole path into every stroke it touches. Returns the element unchanged when the
 * eraser misses it.
 */
export function erasePass(el: BrushElement, worldPts: [number, number][], size: number): BrushElement {
  const local = worldPts.map(([x, y]) => {
    const l = toLocal(el, { x, y });
    return [r1(l.x), r1(l.y)] as [number, number];
  });
  const runs = runsNear(local, el.width, el.height, size / 2 + 1);
  if (!runs.length) return el;
  return capOps({ ...el, ops: [...el.ops, ...runs.map((points) => ({ erase: true as const, size, points }))] });
}

/**
 * Parts of a local polyline that pass within `m` of the box 0..w × 0..h, one run per stretch
 * that stays near it (a point is kept when a segment it belongs to passes near the box).
 */
export function runsNear(local: [number, number][], w: number, h: number, m: number): [number, number][][] {
  const keep = local.map((p) => (local.length === 1 ? crosses(p, p, w, h, m) : false));
  for (let i = 0; i < local.length - 1; i++) {
    if (crosses(local[i], local[i + 1], w, h, m)) keep[i] = keep[i + 1] = true;
  }
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  for (let i = 0; i < local.length; i++) {
    if (keep[i]) run.push(local[i]);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

/** Does the segment a-b pass through the box 0..w × 0..h (grown by m)? */
function crosses(a: [number, number], b: [number, number] | undefined, w: number, h: number, m: number): boolean {
  if (!b) return false;
  const x1 = -m, y1 = -m, x2 = w + m, y2 = h + m;
  if (Math.max(a[0], b[0]) < x1 || Math.min(a[0], b[0]) > x2 || Math.max(a[1], b[1]) < y1 || Math.min(a[1], b[1]) > y2) return false;
  // Liang-Barsky clip test
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - x1], [dx, x2 - a[0]], [-dy, a[1] - y1], [dy, y2 - a[1]]]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Keeps an element within the per-element limits by dropping the oldest eraser passes first. */
function capOps(el: BrushElement): BrushElement {
  const B = LIMITS.brush;
  let ops = el.ops;
  const total = () => ops.reduce((n, o) => n + o.points.length, 0);
  while ((ops.length > B.maxOps || total() > B.maxPoints) && ops.length > 1) {
    const i = ops.findIndex((o) => o.erase);
    ops = ops.filter((_, j) => j !== (i >= 0 ? i : 0));
  }
  return ops === el.ops ? el : { ...el, ops };
}

/** True when two elements (or an element and a new stroke's style) would look the same. */
export function sameStyle(el: BrushElement, s: BrushStyle): boolean {
  const near = (a?: number, b?: number) => Math.abs((a ?? 0) - (b ?? 0)) < 0.05;
  return (
    el.layer === s.layer &&
    el.color.toLowerCase() === s.color.toLowerCase() &&
    (el.texture ?? null) === (s.texture ?? null) &&
    (!s.texture || near(el.textureSize, s.textureSize)) &&
    near(el.softness, s.softness) &&
    (el.edge ?? null)?.toLowerCase() === (s.edge ?? null)?.toLowerCase() &&
    (!s.edge || near(el.edgeWidth, s.edgeWidth)) &&
    near(el.opacity, s.opacity) &&
    (el.line ?? null) === (s.line ?? null) &&
    near(el.spacing ?? 1, s.spacing ?? 1) &&
    (el.accent ?? null)?.toLowerCase() === (s.accent ?? null)?.toLowerCase() &&
    near(el.rough, s.rough) &&
    !!el.flipSide === !!s.flipSide
  );
}

/** Squared distance from a point to a segment. */
function segDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  let x = ax, y = ay;
  const dx = bx - ax, dy = by - ay;
  if (dx || dy) {
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    x += dx * t;
    y += dy * t;
  }
  return (px - x) ** 2 + (py - y) ** 2;
}

/** Distance from a local point to the centre line of one pass. */
function opDist(op: BrushOp, x: number, y: number): number {
  const p = op.points;
  if (p.length === 1) return Math.hypot(x - p[0][0], y - p[0][1]);
  let best = Infinity;
  for (let i = 1; i < p.length; i++) best = Math.min(best, segDistSq(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]));
  return Math.sqrt(best);
}

/** Is the map point on visible paint of the element (not erased)? */
export function paintedAt(el: BrushElement, world: Pt): boolean {
  const { x, y } = toLocal(el, world);
  let painted = false;
  for (const op of el.ops) {
    if (opDist(op, x, y) <= op.size / 2) painted = !op.erase;
  }
  return painted;
}

/**
 * True when every painted pass is covered by later eraser passes, so nothing visible is left.
 * Checked on points sampled along and across each pass (a close approximation).
 */
export function fullyErased(el: BrushElement): boolean {
  for (let i = 0; i < el.ops.length; i++) {
    const op = el.ops[i];
    if (op.erase) continue;
    const later = el.ops.slice(i + 1).filter((o) => o.erase);
    if (!later.length) return false;
    const half = (op.size / 2) * (1 + (el.line ? 0 : roughGrowth(el.rough))) + (el.edge && lineTakesEdge(el.line) ? (el.edgeWidth ?? 0) : 0);
    for (const [x, y, nx, ny] of samples(op.points, Math.max(1, op.size / 4))) {
      for (const k of [-1, -0.5, 0, 0.5, 1]) {
        const sx = x + nx * half * k;
        const sy = y + ny * half * k;
        if (!later.some((e) => opDist(e, sx, sy) <= e.size / 2)) return false;
      }
    }
  }
  return true;
}

/** Points along a polyline every `step` px, with the unit normal at each: [x, y, nx, ny]. */
function samples(pts: [number, number][], step: number): [number, number, number, number][] {
  if (pts.length === 1) return [[pts[0][0], pts[0][1], 0, 1]];
  const out: [number, number, number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = len ? -(by - ay) / len : 0;
    const ny = len ? (bx - ax) / len : 1;
    const n = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j <= n; j++) out.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n, nx, ny]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stroke smoothing
// ---------------------------------------------------------------------------

/** Evenly spaced copy of a polyline (keeps both ends). */
function resample(pts: [number, number][], step: number): [number, number][] {
  if (pts.length < 2) return pts;
  const out: [number, number][] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= len) {
      out.push([ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len]);
      d += step;
    }
    carry = len - (d - step);
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return out;
}

/**
 * Turns raw pointer samples into the stored centre line: resampled, averaged over a window
 * that grows with `smoothing` (0..1), then simplified. Ends stay where the user put them.
 */
export function smoothStroke(raw: [number, number][], size: number, smoothing: number, zoom: number): [number, number][] {
  if (raw.length < 3) return raw;
  const step = Math.max(0.75 / zoom, Math.min(size / 6, 6 / zoom));
  const pts = resample(raw, step);
  const win = Math.round(smoothing * Math.max(2, Math.min(24, (size * 0.9) / step)));
  let out = pts;
  if (win > 0 && pts.length > 2) {
    out = pts.map((p, i) => {
      const k = Math.min(win, i, pts.length - 1 - i);
      if (!k) return p;
      let sx = 0, sy = 0;
      for (let j = i - k; j <= i + k; j++) {
        sx += pts[j][0];
        sy += pts[j][1];
      }
      return [sx / (2 * k + 1), sy / (2 * k + 1)] as [number, number];
    });
  }
  const eps = Math.max(0.3 / zoom, size * 0.01);
  let s = simplify(out, eps);
  // Very long strokes: simplify harder until they fit the per-pass limit.
  for (let e = eps * 2; s.length > LIMITS.brush.maxOpPoints; e *= 2) s = simplify(out, e);
  return s;
}

/**
 * The top-most editable brush element with the same look whose paint is under the point -
 * a new stroke starting there continues that element instead of creating a new one.
 */
export function mergeTarget(doc: MapContent, start: Pt, style: BrushStyle): BrushElement | null {
  const layer = doc.layers.find((l) => l.id === style.layer);
  if (layer && (layer.locked || !layer.visible)) return null;
  for (let i = doc.elements.length - 1; i >= 0; i--) {
    const el = doc.elements[i];
    if (el.type !== "brush" || el.locked || el.layer !== style.layer) continue;
    if (sameStyle(el, style) && paintedAt(el, start)) return el;
  }
  return null;
}

/**
 * Style changes (size of all passes, edge, softness…) can change how far paint reaches:
 * applies the patch and refits the box.
 */
export function restyleBrush(el: BrushElement, patch: Partial<BrushElement>): BrushElement {
  return fitBrushBox({ ...el, ...patch });
}

/** Scales every pass width (brush and eraser) by k - the "brush size" of an existing stroke. */
export function resizePasses(el: BrushElement, k: number): BrushElement {
  return fitBrushBox({ ...el, ops: el.ops.map((o) => ({ ...o, size: Math.min(LIMITS.brush.maxSize, Math.max(0.5, o.size * k)) })) });
}

/** Diameter (px) of the outline that follows the pointer for the active tool. */
export function ringPx(b: BrushSettings, eraser: boolean, grid: number): number {
  if (eraser) return brushPx(b.eraserSize, grid);
  if (b.kind === "scatter") return brushPx(b.scatterSpread + b.scatterScale, grid);
  return brushPx(b.size, grid);
}
