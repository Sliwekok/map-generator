import "server-only";
import type { MapDoc } from "@/lib/types";
import type { MapDocument } from "@/lib/server/models";

export function toMapDoc(d: MapDocument): MapDoc {
  return {
    id: d._id.toString(),
    source: "cloud",
    name: d.name,
    width: d.width,
    height: d.height,
    background: d.background,
    grid: d.grid,
    layers: d.layers,
    elements: (d.elements ?? []) as MapDoc["elements"],
    revision: d.revision ?? 0,
    createdAt: new Date(d.createdAt).toISOString(),
    updatedAt: new Date(d.updatedAt).toISOString(),
  };
}
