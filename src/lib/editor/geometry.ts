import type { MapElement, TextElement } from "@/lib/types";

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const RAD = Math.PI / 180;

export function rotatePt(p: Pt, c: Pt, deg: number): Pt {
  if (!deg) return { ...p };
  const a = deg * RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

export function center(el: Box): Pt {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

export function corners(el: MapElement): Pt[] {
  const c = center(el);
  const pts = [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x + el.width, y: el.y + el.height },
    { x: el.x, y: el.y + el.height },
  ];
  return pts.map((p) => rotatePt(p, c, el.rotation));
}

/** Axis-aligned bounding box of a (possibly rotated) element. */
export function aabb(el: MapElement): Box {
  if (!el.rotation) return { x: el.x, y: el.y, width: el.width, height: el.height };
  const pts = corners(el);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of boxes) {
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.width);
    y2 = Math.max(y2, b.y + b.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function normBox(p1: Pt, p2: Pt): Box {
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  };
}

export function snapValue(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function normAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Math.round(a * 100) / 100;
}

const MIN = 2;

/**
 * Scales one element. `sx`/`sy` are applied in the frame whose rotation is `frameAngle`,
 * around `pivot` (world coordinates). Handles the per-type details (text font size, path points).
 */
export function scaleElement(el: MapElement, sx: number, sy: number, pivot: Pt, frameAngle = 0): MapElement {
  const c = center(el);
  // center in frame-local coordinates relative to pivot
  const local = rotatePt(c, pivot, -frameAngle);
  const nl = { x: pivot.x + (local.x - pivot.x) * sx, y: pivot.y + (local.y - pivot.y) * sy };
  const nc = rotatePt(nl, pivot, frameAngle);

  // factor mapping onto the element's own axes
  const rel = (el.rotation - frameAngle) * RAD;
  const swap = Math.abs(Math.sin(rel)) > Math.SQRT1_2;
  let fx = Math.abs(swap ? sy : sx);
  let fy = Math.abs(swap ? sx : sy);

  if (el.type === "text") {
    const s = Math.sqrt(fx * fy);
    fx = s;
    fy = s;
  }
  const width = Math.max(MIN, el.width * fx);
  const height = Math.max(MIN, el.height * fy);
  const next = { ...el, width, height, x: nc.x - width / 2, y: nc.y - height / 2 } as MapElement;

  if (next.type === "text") {
    (next as TextElement).fontSize = Math.max(4, (el as TextElement).fontSize * fx);
  } else if (next.type === "path" && el.type === "path") {
    const kx = width / el.width;
    const ky = height / el.height;
    next.points = el.points.map(([px, py]) => [px * kx, py * ky] as [number, number]);
  }
  return next;
}

export function rotateElementAround(el: MapElement, pivot: Pt, deg: number): MapElement {
  const c = rotatePt(center(el), pivot, deg);
  return { ...el, x: c.x - el.width / 2, y: c.y - el.height / 2, rotation: normAngle(el.rotation + deg) };
}

export function translateElement(el: MapElement, dx: number, dy: number): MapElement {
  return { ...el, x: el.x + dx, y: el.y + dy };
}

/** Ramer–Douglas–Peucker simplification for freehand strokes. */
export function simplify(points: [number, number][], eps: number): [number, number][] {
  if (points.length < 3) return points;
  const sqEps = eps * eps;
  const distSq = (p: number[], a: number[], b: number[]) => {
    let x = a[0], y = a[1];
    let dx = b[0] - x, dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; }
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = distSq(points[i], points[first], points[last]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sqEps && idx > 0) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function pathD(points: [number, number][], closed?: boolean): string {
  if (!points.length) return "";
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M${r(points[0][0])} ${r(points[0][1])}`;
  for (let i = 1; i < points.length; i++) d += `L${r(points[i][0])} ${r(points[i][1])}`;
  return closed ? d + "Z" : d;
}
