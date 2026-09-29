import type { MapContent, MapElement } from "@/lib/types";
import { createMapContent } from "@/lib/mapContent";

const G = 70;
let n = 0;
const a = (assetId: string, cx: number, cy: number, w: number, h: number, extra: Partial<MapElement> = {}): MapElement =>
  ({
    id: `demo${n++}`,
    type: "asset",
    assetId,
    x: cx * G,
    y: cy * G,
    width: w * G,
    height: h * G,
    rotation: 0,
    opacity: 1,
    layer: "objects",
    ...extra,
  }) as MapElement;

/** A small sample scene built only from the free asset pack. */
export function demoMap(title: string): MapContent {
  n = 0;
  const doc = createMapContent({
    name: "Demo",
    width: 14 * G,
    height: 9 * G,
    grid: { enabled: true, size: G, opacity: 0.22 },
    background: { color: "#7fae4e", pattern: "grass", patternScale: 1 },
  });
  doc.elements = [
    {
      id: "road",
      type: "path",
      x: 0,
      y: 4.2 * G,
      width: 14 * G,
      height: 3 * G,
      rotation: 0,
      opacity: 1,
      layer: "terrain",
      points: [
        [0, 1.4 * G],
        [3 * G, 0.6 * G],
        [6 * G, 1.2 * G],
        [9 * G, 2.4 * G],
        [14 * G, 1.6 * G],
      ],
      stroke: "#b8985a",
      strokeWidth: 0.9 * G,
    },
    a("pond", 9.5, 0.5, 3, 2.4, { layer: "terrain" }),
    a("tree", 0.3, 0.2, 2, 2),
    a("tree", 2.2, 1, 2, 2),
    a("tree", 0.5, 6.8, 2, 2),
    a("bush", 4.3, 0.4, 1, 1),
    a("bush", 12.6, 7.6, 1, 1),
    a("rock", 7, 7.3, 1, 1, { layer: "terrain" }),
    a("rock", 8, 0.3, 1, 1, { layer: "terrain", rotation: 40 }),
    a("grass-tuft", 5.2, 7.5, 1, 1, { layer: "terrain" }),
    a("house", 5, 1.5, 3, 2.5, { rotation: -6 }),
    a("door", 6, 4, 1, 0.3, { rotation: -6 }),
    a("campfire", 11, 4, 1, 1),
    a("wall", 10, 6.4, 2, 0.5, { rotation: 20 }),
    a("chest", 12.2, 5.4, 1, 0.7),
    a("token-hero", 3, 5, 1, 1, { layer: "tokens" }),
    a("token-hero", 4, 5, 1, 1, { layer: "tokens", tint: "#27ae60" } as Partial<MapElement>),
    a("token-monster", 10, 4.8, 1, 1, { layer: "tokens" }),
    a("token-monster", 12, 3.2, 1, 1, { layer: "tokens" }),
    a("marker-x", 12.2, 6.3, 1, 1, { layer: "labels" }),
    {
      id: "label",
      type: "text",
      x: 0.35 * G,
      y: 3.1 * G,
      width: 4.4 * G,
      height: 0.6 * G,
      rotation: -4,
      opacity: 1,
      layer: "labels",
      text: title,
      fontSize: 30,
      color: "#2b2118",
      fontFamily: "serif",
      bold: true,
      italic: true,
      outline: "#f3ead7",
    },
  ];
  return doc;
}
