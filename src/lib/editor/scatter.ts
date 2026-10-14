// Scatter brush: drops library graphics along a stroke. Every stamp becomes an ordinary
// asset item (move, delete, recolour as usual). Pure and seeded: the same stroke and seed
// always give the same stamps, so the live preview doesn't jump while painting.

import type { AssetDef, AssetElement, LayerId } from "@/lib/types";
import { along, flattenSmooth, rng, type P } from "./brushLines";
import type { ScatterRotate } from "./brush";
import { newId } from "./store";

export interface ScatterOptions {
  assets: AssetDef[];
  grid: number; // px per cell (asset sizes are in cells)
  scale: number; // × the asset's own size
  jitter: number; // 0..1 size variation
  /** Gap between stamps as a multiple of their size (1 = edges about touching). */
  spacing: number;
  spread: number; // px across the stroke (total width)
  rotate: ScatterRotate;
  flip: boolean;
  layer: LayerId | "auto";
  opacity: number;
  seed: number;
  /** Stamps at most (the map's element limit). */
  max: number;
}

/** Random numbers of one stamp: depend only on the seed and the stamp's index along the stroke. */
const stampRng = (seed: number, k: number) => rng((seed + Math.imul(k + 1, 0x9e3779b1)) >>> 0);

/** The stamps for a stroke given as a centre line in map coordinates. */
export function scatterStamps(path: P[], o: ScatterOptions): AssetElement[] {
  if (!o.assets.length || !path.length || o.max <= 0) return [];
  const factor = Math.max(0.1, o.spacing);
  // What stamp k is (graphic, size, offset…) depends only on the seed and k, so the gaps -
  // which depend on the sizes of neighbouring stamps - are known before placing them.
  const pick = (k: number) => {
    const r = stampRng(o.seed, k);
    const asset = o.assets[Math.min(o.assets.length - 1, Math.floor(r() * o.assets.length))];
    const f = Math.max(0.05, o.scale * (1 + o.jitter * (r() * 2 - 1) * 0.5));
    return { asset, f, off: r() * 2 - 1, angle: r() * 360, mirror: r() < 0.5, diam: Math.max(asset.cells[0], asset.cells[1]) * o.grid * f };
  };
  const stamps: ReturnType<typeof pick>[] = [];
  const at = (k: number) => (stamps[k] ??= pick(k));
  const gaps = rng(o.seed);
  let k = 0;
  const gapAfter = () => {
    const g = factor * ((at(k).diam + at(k + 1).diam) / 2) * (0.85 + 0.3 * gaps());
    k++;
    return Math.max(2, g);
  };
  const cap = Math.min(o.max, 2000);
  const poly = path.length >= 3 ? flattenSmooth(path, Math.max(1, (at(0).diam * factor) / 8)) : path;
  const stations = along(poly, gapAfter, 0, false, cap * 2);
  const out: AssetElement[] = [];
  const centres: [number, number, number][] = [];
  for (let i = 0; i < stations.length && out.length < o.max; i++) {
    const st = stations[i];
    const s = at(i);
    const off = s.off * (o.spread / 2);
    const cx = st.x - st.ty * off;
    const cy = st.y + st.tx * off;
    // A curling stroke can bring stamps on top of each other: skip those.
    const tooClose = centres.slice(-12).some(([x, y, d]) => Math.hypot(x - cx, y - cy) < factor * 0.4 * (d + s.diam) / 2);
    if (tooClose) continue;
    centres.push([cx, cy, s.diam]);
    const width = Math.round(s.asset.cells[0] * o.grid * s.f * 10) / 10;
    const height = Math.round(s.asset.cells[1] * o.grid * s.f * 10) / 10;
    const rotation =
      o.rotate === "random" ? Math.round(s.angle) : o.rotate === "follow" ? Math.round((Math.atan2(st.ty, st.tx) * 180) / Math.PI) : 0;
    const el: AssetElement = {
      id: newId(),
      type: "asset",
      assetId: s.asset.id,
      x: Math.round((cx - width / 2) * 10) / 10,
      y: Math.round((cy - height / 2) * 10) / 10,
      width: Math.max(1, width),
      height: Math.max(1, height),
      rotation: rotation > 180 ? rotation - 360 : rotation,
      opacity: o.opacity,
      layer: o.layer === "auto" ? s.asset.layer : o.layer,
    };
    if (o.flip && s.mirror) el.flipX = true;
    out.push(el);
  }
  return out;
}

/** A fresh seed for a new stroke. */
export const newSeed = () => (Math.random() * 0xffffffff) >>> 0;
