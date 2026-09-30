// Pure drawing helpers for painted (brush) elements - safe to use in any renderer.

import type { BrushElement } from "@/lib/types";

/** How far a soft edge fades in and out around the stroke outline (px, each side). */
export const featherOf = (softness: number | undefined, size: number) => (softness ?? 0) * size * 0.5;

/** Width of the widest painted pass (shown as the stroke's size in the properties panel). */
export const mainSize = (el: BrushElement) => Math.max(0, ...el.ops.filter((o) => !o.erase).map((o) => o.size));

/** Smooth SVG path through the points (Catmull-Rom as cubic Béziers). A single point is a dot. */
export function smoothD(points: [number, number][]): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  if (!points.length) return "";
  const [x0, y0] = points[0];
  if (points.length === 1) return `M${r(x0)} ${r(y0)}h0.01`;
  if (points.length === 2) return `M${r(x0)} ${r(y0)}L${r(points[1][0])} ${r(points[1][1])}`;
  let d = `M${r(x0)} ${r(y0)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}
