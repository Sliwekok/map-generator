import type { AssetDef, AssetElement, MapContent, PathElement, ShapeElement, UploadInfo } from "@/lib/types";
import { newId } from "./store";
import { snapValue, type Box, type Pt } from "./geometry";

/** Snaps a box so that it lines up with the grid: edges for big items, cell centers for small ones. */
export function snapBox(b: Box, g: number): Pt {
  const snapAxis = (pos: number, size: number) => {
    if (size >= g * 0.99) return snapValue(pos, g);
    const c = pos + size / 2;
    return Math.floor(c / g) * g + g / 2 - size / 2;
  };
  return { x: snapAxis(b.x, b.width), y: snapAxis(b.y, b.height) };
}

export function assetElement(asset: AssetDef, at: Pt, doc: MapContent, snap: boolean): AssetElement {
  const g = doc.grid.size || 70;
  const width = asset.cells[0] * g;
  const height = asset.cells[1] * g;
  let x = at.x - width / 2;
  let y = at.y - height / 2;
  if (snap) ({ x, y } = snapBox({ x, y, width, height }, g));
  return { id: newId(), type: "asset", assetId: asset.id, x, y, width, height, rotation: 0, opacity: 1, layer: asset.layer };
}

export function uploadElement(u: UploadInfo, at: Pt, doc: MapContent, snap: boolean): AssetElement {
  let width = u.width || 256;
  let height = u.height || 256;
  // Fit into the page if larger.
  const k = Math.min(1, doc.width / width, doc.height / height);
  width *= k;
  height *= k;
  const big = width >= doc.width * 0.5 || height >= doc.height * 0.5;
  let x = at.x - width / 2;
  let y = at.y - height / 2;
  if (big && k < 1) {
    x = (doc.width - width) / 2;
    y = (doc.height - height) / 2;
  } else if (snap) ({ x, y } = snapBox({ x, y, width, height }, doc.grid.size || 70));
  return {
    id: newId(),
    type: "asset",
    assetId: `u:${u.id}`,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    layer: big ? "background" : "objects",
  };
}

export function shapeElement(kind: "rect" | "ellipse", box: Box, doc: MapContent): ShapeElement {
  const g = doc.grid.size || 70;
  const b = box.width < 4 && box.height < 4 ? { x: box.x - g / 2, y: box.y - g / 2, width: g, height: g } : box;
  return {
    id: newId(),
    type: kind,
    ...b,
    width: Math.max(2, b.width),
    height: Math.max(2, b.height),
    rotation: 0,
    opacity: 1,
    layer: "terrain",
    fill: kind === "rect" ? "#8b5a2b" : "#4d8fc4",
    fillOpacity: 0.6,
    stroke: "#3b2f23",
    strokeWidth: 3,
    radius: 0,
  };
}

export function pathElement(worldPts: [number, number][], doc: MapContent): PathElement | null {
  if (worldPts.length < 2) return null;
  const xs = worldPts.map((p) => p[0]);
  const ys = worldPts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - x);
  const height = Math.max(1, Math.max(...ys) - y);
  if (width < 2 && height < 2) return null;
  return {
    id: newId(),
    type: "path",
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    layer: "terrain",
    points: worldPts.map(([px, py]) => [px - x, py - y]),
    stroke: "#3b2f23",
    strokeWidth: Math.max(2, Math.round((doc.grid.size || 70) * 0.1)),
  };
}
