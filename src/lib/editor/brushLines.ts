// Geometry for brush line styles (dashed, double, rail, fence, cliff), rough outlines and
// the scatter brush. Pure and deterministic: the same element always draws the same way,
// in the editor, in thumbnails and in exports.

import type { BrushElement, BrushLine } from "@/lib/types";

export type P = [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

/** 32-bit FNV-1a hash of a string (element ids → seeds). */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small fast PRNG (mulberry32): returns numbers in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pseudo-random value in [-1, 1] for an integer lattice point. */
function lattice(seed: number, i: number): number {
  let h = Math.imul((seed ^ Math.imul(i, 0x27d4eb2d)) >>> 0, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77);
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

/** Smooth 1-D value noise in [-1, 1]. */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = lattice(seed, i);
  return a + (lattice(seed, i + 1) - a) * u;
}

// ---------------------------------------------------------------------------
// Walking along the drawn curve
// ---------------------------------------------------------------------------

/**
 * The smooth curve `smoothD()` draws (Catmull-Rom as cubic Béziers), as a polyline with points
 * about `step` apart - so hatching and stamps follow exactly what is on screen.
 */
export function flattenSmooth(points: P[], step: number): P[] {
  if (points.length < 3) return points.slice();
  const out: P[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    const net = Math.hypot(c1x - p1[0], c1y - p1[1]) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(p2[0] - c2x, p2[1] - c2y);
    const n = Math.min(64, Math.max(1, Math.ceil(net / Math.max(0.25, step))));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const m = 1 - t;
      const a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
      out.push([a * p1[0] + b * c1x + c * c2x + d * p2[0], a * p1[1] + b * c1y + c * c2y + d * p2[1]]);
    }
  }
  return out;
}

export function polyLength(poly: P[]): number {
  let len = 0;
  for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
  return len;
}

/** A point on the curve: position, unit tangent and distance from the start. */
export interface Station {
  x: number;
  y: number;
  tx: number;
  ty: number;
  s: number;
}

/**
 * Points along a polyline: the first at `start`, then each `gap()` further on (the gap may
 * vary). `end` also adds the very last point. A single point gives one station facing right.
 */
export function along(poly: P[], gap: () => number, start = 0, end = false, max = 5000): Station[] {
  if (!poly.length) return [];
  if (poly.length === 1) return [{ x: poly[0][0], y: poly[0][1], tx: 1, ty: 0, s: 0 }];
  const out: Station[] = [];
  let next = start;
  let done = 0; // length of the segments already walked
  let tx = 1, ty = 0;
  for (let i = 1; i < poly.length && out.length < max; i++) {
    const [ax, ay] = poly[i - 1];
    const [bx, by] = poly[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-9) continue;
    tx = (bx - ax) / len;
    ty = (by - ay) / len;
    while (next <= done + len + 1e-9 && out.length < max) {
      const t = (next - done) / len;
      out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, tx, ty, s: next });
      next += Math.max(1e-3, gap());
    }
    done += len;
  }
  if (end && out.length < max) {
    const last = poly[poly.length - 1];
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(prev.x - last[0], prev.y - last[1]) > 1e-6) out.push({ x: last[0], y: last[1], tx, ty, s: done });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Line styles
// ---------------------------------------------------------------------------

/** Proportions of each line style, relative to the brush size (the full width of the band). */
export const LINE = {
  doubleLine: (size: number) => Math.max(1, size * 0.16),
  railGauge: (size: number) => size * 0.62,
  railLine: (size: number) => Math.max(1, size * 0.09),
  tie: (size: number) => Math.max(1, size * 0.14),
  fenceLine: (size: number) => Math.max(1, size * 0.14),
  post: (size: number) => Math.max(1.5, size * 0.5),
  cliffLine: (size: number) => Math.max(1, size * 0.12),
  hatch: (size: number) => Math.max(0.75, size * 0.07),
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const dash = (a: number, b: number) => `${r2(Math.max(0.01, a))} ${r2(Math.max(0.1, b))}`;

/** stroke-dasharray for dashed / dotted strokes, rail ties and fence posts. */
export function dashArray(kind: "dashed" | "dotted" | "ties" | "posts", size: number, spacing = 1): string {
  const sp = Math.max(0.25, spacing);
  switch (kind) {
    case "dashed": {
      // Round caps add half the width at both ends of every dash.
      const L = 2.2 * size * sp;
      const G = 1.4 * size * sp;
      return dash(L - size, G + size);
    }
    case "dotted": {
      const period = Math.max(size * 1.1, 2 * size * sp);
      return dash(0.01, period - 0.01);
    }
    case "ties": {
      const w = LINE.tie(size);
      return dash(w, Math.max(w, size * 0.42 * sp));
    }
    case "posts": {
      const p = LINE.post(size);
      return dash(p, Math.max(p, size * 1.8 * sp));
    }
  }
}

/** Does this style draw a texture? (Rails, fences and cliffs are drawn in colour only.) */
export const lineTakesTexture = (line: BrushLine | undefined) => !line || line === "solid" || line === "dashed" || line === "dotted" || line === "double";
/** Does this style draw the edge outline? */
export const lineTakesEdge = (line: BrushLine | undefined) => !line || line === "solid" || line === "dashed" || line === "dotted";
/** Does this style use the second colour? */
export const lineTakesAccent = (line: BrushLine | undefined) => line === "rail" || line === "fence";
/** Does this style use the spacing slider? */
export const lineTakesSpacing = (line: BrushLine | undefined) => line === "dashed" || line === "dotted" || line === "rail" || line === "fence" || line === "cliff";

/**
 * Cliff hatching: short strokes from the line out to one side (left of the drawing direction,
 * or right with `flip`), with slightly varied length and slant.
 */
export function cliffD(points: P[], size: number, spacing: number, flip: boolean, seed: number): string {
  const R = size / 2;
  const poly = flattenSmooth(points, Math.max(0.5, R * 0.1));
  const step = Math.max(1.5, size * 0.22 * Math.max(0.25, spacing));
  const rand = rng(seed);
  const side = flip ? -1 : 1;
  const base = LINE.cliffLine(size) * 0.4;
  let d = "";
  for (const st of along(poly, () => step, step / 2, false, 4000)) {
    const nx = st.ty * side;
    const ny = -st.tx * side;
    const len = R * (0.45 + 0.55 * rand());
    const slant = (rand() - 0.5) * 0.35 * len;
    const x0 = st.x + nx * base;
    const y0 = st.y + ny * base;
    d += `M${r1(x0)} ${r1(y0)}L${r1(st.x + nx * len + st.tx * slant)} ${r1(st.y + ny * len + st.ty * slant)}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Rough (organic) outline
// ---------------------------------------------------------------------------

const roughAmp = (k: number) => k * 0.35; // broad radius / offset variation
const roughJag = (k: number) => 0.02 + 0.2 * k ** 1.5; // fine jaggedness of the outline

/** How much a rough outline can grow past the brush size (fraction of the half-width). */
export function roughGrowth(rough: number | undefined): number {
  const k = Math.max(0, Math.min(1, rough ?? 0));
  if (!k) return 0;
  const a = roughAmp(k);
  return (1 + a * 1.6) * (1 + roughJag(k)) - 1;
}

/**
 * A rough, organic band along the curve: a union of overlapping circles whose radius and
 * offset follow seeded noise - broad bays and headlands plus fine, jagged detail that grows
 * with `rough`. Filled with the nonzero rule the circles merge into one shape; stroking the
 * same path (under the fill) gives an outline that follows it.
 */
export function roughD(points: P[], size: number, rough: number, seed: number): string {
  const R = size / 2;
  const k = Math.max(0, Math.min(1, rough));
  const a = roughAmp(k);
  // Broad shape, medium wobble, and fine jagged detail (sampled per circle).
  const radius = (s: number) =>
    R * (1 + a * (0.55 * noise1(seed, s / (R * 1.8)) + 0.3 * noise1(seed + 1, s / (R * 0.5)) + 0.15 * (0.5 + k) * noise1(seed + 3, s / (R * 0.16))));
  const offset = (s: number) => R * a * 0.6 * noise1(seed + 2, s / (R * 1.3));
  const poly = flattenSmooth(points, Math.max(0.5, R * 0.12));
  const len = polyLength(poly);
  if (poly.length < 2 || len < R * 0.3) {
    // A dab: a noisy blob around the point.
    const [cx, cy] = poly[0] ?? [0, 0];
    let d = "";
    const n = 36;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const r = R * (1 + a * (0.6 * noise1(seed, i * 0.35) + 0.4 * noise1(seed + 1, i * 1.3)));
      d += `${i ? "L" : "M"}${r1(cx + Math.cos(t) * r)} ${r1(cy + Math.sin(t) * r)}`;
    }
    return d + "Z";
  }
  // Each stamp along the curve is a jagged blob (radius varies with the angle); their union is the
  // band. Blobs are closed shapes with the same winding, so the nonzero fill never leaves holes.
  const step = Math.max(0.5, R * (0.32 - 0.12 * k), len / 1500);
  const jag = roughJag(k); // angular jaggedness of each blob
  const sides = 18;
  let d = "";
  let idx = 0;
  for (const st of along(poly, () => step, 0, true, 1600)) {
    const o = offset(st.s);
    const cx = st.x - st.ty * o;
    const cy = st.y + st.tx * o;
    const base = Math.max(R * 0.2, radius(st.s));
    const bs = (seed + Math.imul(++idx, 0x2545f491)) >>> 0;
    const turn = lattice(bs, 7) * Math.PI;
    for (let i = 0; i < sides; i++) {
      const t = turn + (i / sides) * Math.PI * 2;
      const r = base * (1 + jag * lattice(bs, i));
      d += `${i ? "L" : "M"}${r1(cx + Math.cos(t) * r)} ${r1(cy + Math.sin(t) * r)}`;
    }
    d += "Z";
  }
  return d;
}

/** Seed of one pass: stable for the element's lifetime (moving / restyling keeps the shape). */
export const opSeed = (el: Pick<BrushElement, "id">, index: number) => (hashStr(el.id) ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
