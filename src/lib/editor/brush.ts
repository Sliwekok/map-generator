// Brush painting helpers: element creation, merging passes, erasing, smoothing and the
// curve used to draw strokes. Everything here is pure (no store / DOM access).

import type { BrushElement, BrushOp, LayerId, MapContent, MapElement } from "@/lib/types";
import { LIMITS } from "@/lib/limits";
import { center, rotatePt, simplify, type Box, type Pt } from "./geometry";
import { newId } from "./store";
import { featherOf } from "./brushShape";

export { featherOf, mainSize, smoothD } from "./brushShape";

/** Brush settings as the painter UI keeps them (sizes are in grid cells, so they suit any map). */
export interface BrushSettings {
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
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 0.6,
  color: "#3f7fb5",
  texture: null,
  textureScale: 1,
  softness: 0.15,
  smoothing: 0.5,
  edge: true,
  edgeColor: "#6b5a3e",
  edgeWidth: 0.08,
  opacity: 1,
  layer: "terrain",
  merge: true,
  eraserSize: 0.8,
};

export interface BrushPreset {
  id: string;
  /** Tried in order: the first texture the user can use wins; otherwise the colour alone is used. */
  textures: string[];
  settings: Partial<BrushSettings>;
}

export const BRUSH_PRESETS: BrushPreset[] = [
  { id: "river", textures: ["p-water"], settings: { size: 0.8, color: "#3f7fb5", textureScale: 1.5, softness: 0.15, edge: true, edgeColor: "#7a6a45", edgeWidth: 0.1, layer: "terrain" } },
  { id: "stream", textures: ["p-water"], settings: { size: 0.3, color: "#4d8fc4", textureScale: 1, softness: 0.2, edge: true, edgeColor: "#7a6a45", edgeWidth: 0.05, layer: "terrain" } },
  { id: "road", textures: ["cobble"], settings: { size: 1, color: "#8d8173", textureScale: 0.5, softness: 0, edge: true, edgeColor: "#4a4238", edgeWidth: 0.06, layer: "terrain" } },
  { id: "path", textures: [], settings: { size: 0.45, color: "#a07d52", softness: 0.6, edge: false, layer: "terrain" } },
  { id: "lava", textures: ["p-lava-rock"], settings: { size: 0.9, color: "#e8590c", textureScale: 1, softness: 0.15, edge: true, edgeColor: "#2b1d16", edgeWidth: 0.1, layer: "terrain" } },
  { id: "sand", textures: ["p-sand"], settings: { size: 1.5, color: "#e3cf96", textureScale: 1, softness: 0.8, edge: false, layer: "terrain" } },
  { id: "grass", textures: ["grass"], settings: { size: 1.5, color: "#7fae4e", textureScale: 1, softness: 0.8, edge: false, layer: "terrain" } },
  { id: "snow", textures: ["p-snow"], settings: { size: 1.5, color: "#f1f5f9", textureScale: 1, softness: 0.8, edge: false, layer: "terrain" } },
  { id: "wall", textures: [], settings: { size: 0.2, color: "#3d3a36", softness: 0, edge: true, edgeColor: "#141312", edgeWidth: 0.03, layer: "objects" } },
];

/** Settings a preset produces, given which textures the user can use. */
export function presetSettings(p: BrushPreset, canUse: (texture: string) => boolean): Partial<BrushSettings> {
  return { ...p.settings, texture: p.textures.find(canUse) ?? null };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const r1 = (n: number) => Math.round(n * 10) / 10;


/** How far paint of one pass reaches beyond its centre line (stroke, edge and feathering). */
function reach(el: Pick<BrushElement, "softness" | "edge" | "edgeWidth">, size: number): number {
  return size / 2 + (el.edge ? (el.edgeWidth ?? 0) : 0) + featherOf(el.softness, size) / 2 + 1;
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
}

/** Resolves UI settings (cells) into the pixel style stored on elements. */
export function styleFrom(b: BrushSettings, grid: number): BrushStyle {
  return {
    color: b.color,
    texture: b.texture,
    textureSize: b.texture ? Math.max(2, Math.round(b.textureScale * grid * 10) / 10) : undefined,
    softness: b.softness > 0 ? b.softness : undefined,
    edge: b.edge ? b.edgeColor : null,
    edgeWidth: b.edge ? Math.max(0.5, Math.round(b.edgeWidth * grid * 10) / 10) : undefined,
    opacity: b.opacity,
    layer: b.layer,
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
  };
  return fitBrushBox(el);
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
  const m = size / 2 + 1;
  // A point is kept when a segment it belongs to passes near the element.
  const keep = local.map((p) => (local.length === 1 ? crosses(p, p, el, m) : false));
  for (let i = 0; i < local.length - 1; i++) {
    if (crosses(local[i], local[i + 1], el, m)) keep[i] = keep[i + 1] = true;
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
  if (!runs.length) return el;
  return capOps({ ...el, ops: [...el.ops, ...runs.map((points) => ({ erase: true as const, size, points }))] });
}

/** Does the segment a-b pass through the element box (grown by m)? */
function crosses(a: [number, number], b: [number, number] | undefined, el: BrushElement, m: number): boolean {
  if (!b) return false;
  const x1 = -m, y1 = -m, x2 = el.width + m, y2 = el.height + m;
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
    near(el.opacity, s.opacity)
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
    const half = op.size / 2 + (el.edge ? (el.edgeWidth ?? 0) : 0);
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
