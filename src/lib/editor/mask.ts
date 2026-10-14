// Erasing parts of uploaded images and library graphics (and painting them back).
// The image itself is never changed: each graphic keeps an ordered list of eraser / restore
// passes that the renderers turn into an SVG mask. Everything here is pure.

import type { AssetElement, GraphicMask, MapContent, MapElement, MaskOp } from "@/lib/types";
import { LIMITS } from "@/lib/limits";
import { runsNear, toLocal } from "./brush";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Items the graphic eraser works on: uploaded images and built-in library graphics. */
export const isGraphic = (el: MapElement | undefined | null): el is AssetElement => el?.type === "asset";

/** Soft edge (px) of an eraser pass for a softness setting 0..1 - same curve as the brush. */
export const maskFeather = (softness: number, size: number) => Math.max(0, softness) * size * 0.5;

export const erasedPasses = (el: AssetElement) => el.mask?.ops.filter((o) => o.erase).length ?? 0;

const totalPoints = (ops: MaskOp[]) => ops.reduce((n, o) => n + o.points.length, 0);

/**
 * Is there room for another eraser stroke on this graphic? A stroke never makes the mask go
 * over the limits - it is cut short instead - so the UI asks before the stroke starts.
 */
export function maskHasRoom(el: AssetElement): boolean {
  const ops = el.mask?.ops ?? [];
  return ops.length < LIMITS.brush.maxOps && totalPoints(ops) < LIMITS.brush.maxPoints - 50;
}

/**
 * The graphic with one more eraser (or restore) pass, given as a centre line in map
 * coordinates. Only the parts of the stroke that reach the graphic are kept. A restore pass on
 * a graphic with nothing erased changes nothing. `size` / `soft` are map px.
 */
export function maskPass(el: AssetElement, worldPts: [number, number][], size: number, soft: number, erase: boolean): AssetElement {
  const m: GraphicMask = el.mask ?? { w: r1(el.width), h: r1(el.height), ops: [] };
  if (!erase && !m.ops.some((o) => o.erase)) return el;
  // The mask may have been recorded at another item size: work in its own units.
  const kx = m.w / el.width;
  const ky = m.h / el.height;
  const k = Math.sqrt(kx * ky);
  const s = Math.max(0.5, r1(size * k));
  const f = r1(soft * k);
  const local = worldPts.map(([x, y]) => {
    const l = toLocal(el, { x, y });
    return [r1(l.x * kx), r1(l.y * ky)] as [number, number];
  });
  const runs = runsNear(local, m.w, m.h, s / 2 + f + 1);
  if (!runs.length) return el;
  const ops = [...m.ops];
  let room = LIMITS.brush.maxPoints - totalPoints(ops);
  for (const run of runs) {
    if (ops.length >= LIMITS.brush.maxOps || room <= 0) break;
    const points = run.slice(0, Math.min(LIMITS.brush.maxOpPoints, room));
    room -= points.length;
    ops.push({ ...(erase ? { erase: true as const } : {}), size: s, ...(f > 0.05 ? { soft: f } : {}), points });
  }
  if (ops.length === m.ops.length) return el;
  return { ...el, mask: { w: m.w, h: m.h, ops } };
}

/** The graphic with everything erased shown again. */
export function clearMask(el: AssetElement): AssetElement {
  if (!el.mask) return el;
  const next = { ...el };
  delete next.mask;
  return next;
}

/**
 * What the eraser works on for a selection: the selected graphics (if any - then only those),
 * and which of them can be changed (not locked, on a visible, unlocked layer).
 */
export function eraserTargets(doc: MapContent | null, selection: string[]): { graphics: AssetElement[]; editable: AssetElement[] } {
  if (!doc || !selection.length) return { graphics: [], editable: [] };
  const ids = new Set(selection);
  const graphics = doc.elements.filter((e): e is AssetElement => ids.has(e.id) && isGraphic(e));
  const open = new Set(doc.layers.filter((l) => l.visible && !l.locked).map((l) => l.id));
  return { graphics, editable: graphics.filter((g) => !g.locked && open.has(g.layer)) };
}
