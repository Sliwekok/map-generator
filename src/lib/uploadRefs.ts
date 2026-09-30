import type { MapElement } from "./types";

/** Ids of the uploaded images ("u:<id>") one element uses - as an image or as a brush texture. */
export function elementUploadIds(el: MapElement): string[] {
  if (el.type === "asset" && el.assetId.startsWith("u:")) return [el.assetId.slice(2)];
  if (el.type === "brush" && el.texture?.startsWith("u:")) return [el.texture.slice(2)];
  return [];
}

/** Distinct upload ids used by a list of elements. */
export function uploadIdsOf(elements: MapElement[]): string[] {
  return [...new Set(elements.flatMap(elementUploadIds))];
}

/** Points upload references at new ids (e.g. after re-uploading the images of an imported project). */
export function remapElementUploads(el: MapElement, mapping: Record<string, string>): MapElement {
  if (el.type === "asset" && el.assetId.startsWith("u:") && mapping[el.assetId.slice(2)]) {
    return { ...el, assetId: `u:${mapping[el.assetId.slice(2)]}` };
  }
  if (el.type === "brush" && el.texture?.startsWith("u:") && mapping[el.texture.slice(2)]) {
    return { ...el, texture: `u:${mapping[el.texture.slice(2)]}` };
  }
  return el;
}
