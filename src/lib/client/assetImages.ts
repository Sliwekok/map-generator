// Built-in assets drawn as SVG *images* in the editor instead of inline markup.
//
// A detailed asset (a tavern roof, a dressed table) is hundreds of SVG nodes. Inline, every
// copy on the map adds all of them to the page, and the browser has to style, hit-test and
// repaint each one. As an image, a copy is a single node, the drawing is parsed once per
// asset (and tint), and the browser can re-use what it has already drawn. The look is the
// same: the image is the asset's own SVG, scaled exactly like the inline version.
//
// Exports, thumbnails and the home page keep the inline markup (see MapRenderer).

import type { AssetDef } from "@/lib/types";

export interface AssetImage {
  url: string;
  /** Image box relative to the element box, in fractions of its width / height. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";
// Per asset object (a reloaded library brings new objects), then per tint colour.
const cache = new WeakMap<AssetDef, Map<string, AssetImage | null>>();
const margins = new WeakMap<AssetDef, [number, number, number, number] | null>();
let probe: SVGSVGElement | null = null;

/**
 * The asset as an image, or null when it can't be one (no browser, or markup that only
 * works inline) - the caller then draws it inline as before.
 */
export function assetImage(asset: AssetDef, tint: string | undefined): AssetImage | null {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return null;
  let byTint = cache.get(asset);
  if (!byTint) cache.set(asset, (byTint = new Map()));
  const key = asset.tintable ? (tint ?? "") : "";
  if (byTint.has(key)) return byTint.get(key)!;
  const img = build(asset, asset.tintable ? tint : undefined);
  byTint.set(key, img);
  return img;
}

function build(asset: AssetDef, tint: string | undefined): AssetImage | null {
  const vb = asset.viewBox.split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) return null;
  const [vx, vy, vw, vh] = vb;
  const m = margin(asset, vb);
  if (!m) return null;
  const [l, t, r, b] = m;
  const box = `${vx - l} ${vy - t} ${vw + l + r} ${vh + t + b}`;
  const color = tint ? ` color="${escapeAttr(tint)}"` : "";
  const svg =
    `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${box}" ` +
    `preserveAspectRatio="none" overflow="visible"${color}>${asset.body}</svg>`;
  // Markup the HTML parser forgives but XML doesn't (e.g. an HTML entity) would give a blank image.
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.getElementsByTagName("parsererror").length) return null;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  return { url, x: -l / vw, y: -t / vh, w: (vw + l + r) / vw, h: (vh + t + b) / vh };
}

/**
 * How far the drawing reaches outside its viewBox (soft shadows, door swings…), per side,
 * in viewBox units. Inline assets may overflow their box; an image would clip it, so the
 * image is made just big enough.
 */
function margin(asset: AssetDef, [vx, vy, vw, vh]: number[]): [number, number, number, number] | null {
  if (margins.has(asset)) return margins.get(asset)!;
  let out: [number, number, number, number] | null = null;
  try {
    if (!probe) {
      probe = document.createElementNS(SVG_NS, "svg");
      probe.setAttribute("width", "1");
      probe.setAttribute("height", "1");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:absolute;left:-10px;top:-10px;visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
    }
    probe.setAttribute("viewBox", asset.viewBox);
    const g = document.createElementNS(SVG_NS, "g");
    g.innerHTML = asset.body;
    probe.appendChild(g);
    const bb = g.getBBox();
    probe.removeChild(g);
    // getBBox ignores stroke widths - leave a little room for them.
    const pad = Math.max(vw, vh) * 0.03 + 1;
    const side = (overflow: number) => Math.max(0, overflow) + pad;
    out = [side(vx - bb.x), side(vy - bb.y), side(bb.x + bb.width - (vx + vw)), side(bb.y + bb.height - (vy + vh))];
  } catch {
    out = null;
  }
  margins.set(asset, out);
  return out;
}

function escapeAttr(v: string) {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
