import { memo, useMemo } from "react";
import type { AssetDef, BrushElement, LayerId, LayerState, MapContent, MapElement, PatternDef } from "@/lib/types";
import { LAYER_ORDER } from "@/lib/types";
import { FONT_STACKS, LINE_HEIGHT } from "@/lib/editor/text";
import { pathD } from "@/lib/editor/geometry";
import { featherOf, mainSize, smoothD } from "@/lib/editor/brushShape";
import { assetImage } from "@/lib/client/assetImages";

export interface RenderLookups {
  assets: Record<string, AssetDef>;
  patterns: Record<string, PatternDef>;
  /**
   * Uploaded images by id. `null` = known to be missing (placeholder). Ids not listed yet are
   * rendered straight from their API URL, so a map never waits for file metadata.
   */
  uploads: Record<string, { url: string } | null>;
  /** The asset library is still loading: unknown built-in assets are left out instead of drawn as "?". */
  assetsPending?: boolean;
}

const UPLOAD_ID = /^[a-f0-9]{24}$/i;
function uploadUrlOf(uploads: RenderLookups["uploads"], id: string): string | undefined {
  const u = uploads[id];
  if (u === null) return undefined;
  return u?.url ?? (UPLOAD_ID.test(id) ? `/api/uploads/${id}` : undefined);
}

interface Props extends RenderLookups {
  doc: MapContent;
  idPrefix: string;
  showGrid: boolean;
  /** Adds data attributes and hit areas used by the editor canvas. */
  interactive?: boolean;
  /** Elements left out (the editor draws them on an overlay while they are being edited). */
  hidden?: ReadonlySet<string> | null;
}

/**
 * Renders a map in map-space coordinates (0..width, 0..height) as pure SVG.
 * Used by thumbnails, the home page demo and the SVG/PNG export, so what you see is exactly
 * what you export. The editor canvas draws the same parts (background, one group per layer,
 * grid) into separate stacked SVGs instead, so each part is cached by the browser on its own.
 */
export function MapRenderer({ doc, idPrefix, showGrid, interactive, hidden, assets, patterns, uploads, assetsPending }: Props) {
  const { width, height } = doc;
  const clipId = `${idPrefix}-clip`;
  const byLayer = elementsByLayer(doc.elements);
  const layerState = layerStates(doc);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <TextureDefs textures={texturesUsed(doc.elements, patterns)} idPrefix={idPrefix} />
      <g clipPath={`url(#${clipId})`}>
        <MapBackground doc={doc} idPrefix={idPrefix} patterns={patterns} />
        {LAYER_ORDER.map((layerId) => {
          const ls = layerState[layerId];
          if (ls && !ls.visible) return null;
          return (
            <MapLayer
              key={layerId}
              layerId={layerId}
              elements={byLayer[layerId]}
              locked={!!ls?.locked}
              idPrefix={idPrefix}
              interactive={interactive}
              hidden={hidden}
              assets={assets}
              patterns={patterns}
              uploads={uploads}
              assetsPending={assetsPending}
            />
          );
        })}
        {showGrid && <MapGrid doc={doc} idPrefix={idPrefix} />}
      </g>
    </g>
  );
}

export const textureTemplateId = (idPrefix: string, patternId: string) => `${idPrefix}-tex-${patternId}`;

/** Library textures used by brush strokes, each defined once as a pattern template the strokes re-use. */
export function texturesUsed(elements: MapElement[], patterns: RenderLookups["patterns"]): PatternDef[] {
  const seen = new Map<string, PatternDef>();
  for (const el of elements) {
    if (el.type !== "brush" || !el.texture || el.texture.startsWith("u:") || seen.has(el.texture)) continue;
    const p = patterns[el.texture];
    if (p) seen.set(el.texture, p);
  }
  return [...seen.values()];
}

/**
 * Pattern templates for brush textures (see BrushView). Must not be inside a `display: none`
 * subtree, or the browser has nothing to draw the patterns from.
 */
export const TextureDefs = memo(function TextureDefs({ textures, idPrefix }: { textures: PatternDef[]; idPrefix: string }) {
  if (!textures.length) return null;
  return (
    <defs>
      {textures.map((p) => (
        <pattern key={p.id} id={textureTemplateId(idPrefix, p.id)} patternUnits="userSpaceOnUse" width={p.size} height={p.size}>
          <svg width={p.size} height={p.size} viewBox={`0 0 ${p.size} ${p.size}`} preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: p.body }} />
        </pattern>
      ))}
    </defs>
  );
}, (a, b) => a.idPrefix === b.idPrefix && a.textures.length === b.textures.length && a.textures.every((t, i) => t === b.textures[i]));

/** Elements of each layer, in drawing order (one pass over the map). */
export function elementsByLayer(elements: MapElement[]): Record<LayerId, MapElement[]> {
  const out = Object.fromEntries(LAYER_ORDER.map((l) => [l, [] as MapElement[]])) as Record<LayerId, MapElement[]>;
  for (const el of elements) (out[el.layer] ??= []).push(el);
  return out;
}

export function layerStates(doc: MapContent): Partial<Record<LayerId, LayerState>> {
  return Object.fromEntries(doc.layers.map((l) => [l.id, l]));
}

/** Background colour + texture. */
export function MapBackground({ doc, idPrefix, patterns }: { doc: MapContent; idPrefix: string; patterns: RenderLookups["patterns"] }) {
  const { width, height, background, grid } = doc;
  const pattern = background.pattern ? patterns[background.pattern] : undefined;
  const tile = (grid.size || 70) * (background.patternScale || 1);
  const bgPatId = `${idPrefix}-bgpat`;
  return (
    <>
      {pattern && (
        <defs>
          <pattern id={bgPatId} patternUnits="userSpaceOnUse" width={tile} height={tile}>
            <svg
              width={tile}
              height={tile}
              viewBox={`0 0 ${pattern.size} ${pattern.size}`}
              preserveAspectRatio="none"
              dangerouslySetInnerHTML={{ __html: pattern.body }}
            />
          </pattern>
        </defs>
      )}
      <rect x={0} y={0} width={width} height={height} fill={background.color} />
      {pattern && <rect x={0} y={0} width={width} height={height} fill={`url(#${bgPatId})`} pointerEvents="none" />}
    </>
  );
}

/** Grid lines / dots on top of the map (nothing when the grid is switched off). */
export function MapGrid({ doc, idPrefix }: { doc: MapContent; idPrefix: string }) {
  const { width, height, grid } = doc;
  const dotPatId = `${idPrefix}-dots`;
  const d = useMemo(
    () => (grid.enabled && grid.style !== "dots" ? gridPath(width, height, grid.size) : ""),
    [grid.enabled, grid.style, width, height, grid.size],
  );
  if (!grid.enabled) return null;
  return (
    <g opacity={grid.opacity} pointerEvents="none">
      {grid.style === "dots" ? (
        <>
          <defs>
            <pattern id={dotPatId} patternUnits="userSpaceOnUse" width={grid.size} height={grid.size}>
              <circle cx={0} cy={0} r={grid.lineWidth * 1.6} fill={grid.color} />
              <circle cx={grid.size} cy={0} r={grid.lineWidth * 1.6} fill={grid.color} />
              <circle cx={0} cy={grid.size} r={grid.lineWidth * 1.6} fill={grid.color} />
              <circle cx={grid.size} cy={grid.size} r={grid.lineWidth * 1.6} fill={grid.color} />
            </pattern>
          </defs>
          <rect x={0} y={0} width={width} height={height} fill={`url(#${dotPatId})`} />
        </>
      ) : (
        <path d={d} stroke={grid.color} strokeWidth={grid.lineWidth} fill="none" />
      )}
    </g>
  );
}

interface LayerProps extends RenderLookups {
  layerId: LayerId;
  /** This layer's elements in drawing order. */
  elements: MapElement[];
  locked: boolean;
  idPrefix: string;
  interactive?: boolean;
  hidden?: ReadonlySet<string> | null;
  /** Draw built-in assets as cached SVG images (editor) instead of inline markup. */
  assetImages?: boolean;
}

/**
 * One layer of the map. Memoised on the layer's own elements, so editing one layer
 * (dragging a token, painting terrain) doesn't re-render - or make the browser repaint - the others.
 */
export const MapLayer = memo(function MapLayer({
  layerId,
  elements,
  locked,
  idPrefix,
  interactive,
  hidden,
  assetImages,
  assets,
  patterns,
  uploads,
  assetsPending,
}: LayerProps) {
  return (
    <g data-layer={layerId}>
      {elements.map((el) =>
        hidden?.has(el.id) ? null : (
          <ElementView
            key={el.id}
            el={el}
            idPrefix={idPrefix}
            interactive={interactive}
            inert={locked || !!el.locked}
            asset={el.type === "asset" ? assets[el.assetId] : undefined}
            pattern={el.type === "brush" && el.texture && !el.texture.startsWith("u:") ? patterns[el.texture] : undefined}
            pending={assetsPending}
            asImage={assetImages}
            uploadUrl={uploadRef(el) ? uploadUrlOf(uploads, uploadRef(el)!) : undefined}
          />
        ),
      )}
    </g>
  );
}, sameLayerProps);

function sameLayerProps(a: LayerProps, b: LayerProps): boolean {
  for (const k of Object.keys(a) as (keyof LayerProps)[]) {
    if (k === "elements" || k === "hidden") continue;
    if (a[k] !== b[k]) return false;
  }
  if (a.hidden !== b.hidden) {
    if (!a.hidden?.size !== !b.hidden?.size) return false;
    if (a.hidden && b.hidden && (a.hidden.size !== b.hidden.size || [...a.hidden].some((id) => !b.hidden!.has(id)))) return false;
  }
  const x = a.elements;
  const y = b.elements;
  if (x === y) return true;
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

export function gridPath(w: number, h: number, size: number): string {
  if (size < 2) return "";
  let d = "";
  for (let x = 0; x <= w + 0.001; x += size) d += `M${round(x)} 0V${h}`;
  for (let y = 0; y <= h + 0.001; y += size) d += `M0 ${round(y)}H${w}`;
  return d;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** One element drawn on its own (e.g. the stroke being painted, on the editor's overlay layer). */
export function ElementPreview({
  el,
  idPrefix,
  patterns,
  uploads,
}: {
  el: MapElement;
  idPrefix: string;
  patterns: RenderLookups["patterns"];
  uploads: RenderLookups["uploads"];
}) {
  const ref = uploadRef(el);
  return (
    <>
      <TextureDefs textures={texturesUsed([el], patterns)} idPrefix={idPrefix} />
      <ElementView
        el={el}
        idPrefix={idPrefix}
        inert
        pattern={el.type === "brush" && el.texture && !el.texture.startsWith("u:") ? patterns[el.texture] : undefined}
        uploadUrl={ref ? uploadUrlOf(uploads, ref) : undefined}
      />
    </>
  );
}

// Path data is rebuilt only when the points change: moving, rotating or restyling an element
// keeps its points array, so long strokes aren't re-encoded on every pointer move.
const smoothCache = new WeakMap<[number, number][], string>();
function cachedSmoothD(points: [number, number][]): string {
  let d = smoothCache.get(points);
  if (d === undefined) smoothCache.set(points, (d = smoothD(points)));
  return d;
}
const pathCache = new WeakMap<[number, number][], { closed: boolean; d: string }>();
function cachedPathD(points: [number, number][], closed?: boolean): string {
  const hit = pathCache.get(points);
  if (hit && hit.closed === !!closed) return hit.d;
  const d = pathD(points, closed);
  pathCache.set(points, { closed: !!closed, d });
  return d;
}

/** Upload id an element draws from: an uploaded image, or a brush texture from My files. */
function uploadRef(el: MapElement): string | undefined {
  if (el.type === "asset" && el.assetId.startsWith("u:")) return el.assetId.slice(2);
  if (el.type === "brush" && el.texture?.startsWith("u:")) return el.texture.slice(2);
  return undefined;
}

interface ElProps {
  el: MapElement;
  /** Unique per rendered map - brush masks / patterns are referenced by id. */
  idPrefix?: string;
  interactive?: boolean;
  inert: boolean;
  asset?: AssetDef;
  /** Brush texture from the library. */
  pattern?: PatternDef;
  /** Uploaded image, or the brush texture when it comes from My files. */
  uploadUrl?: string;
  pending?: boolean;
  /** Built-in asset as a cached SVG image (see lib/client/assetImages). */
  asImage?: boolean;
}

export function elementTransform(el: MapElement): string {
  const cx = el.width / 2;
  const cy = el.height / 2;
  let t = `translate(${round(el.x)} ${round(el.y)})`;
  if (el.rotation) t += ` rotate(${el.rotation} ${round(cx)} ${round(cy)})`;
  if (el.flipX || el.flipY) {
    t += ` translate(${round(cx)} ${round(cy)}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1}) translate(${round(-cx)} ${round(-cy)})`;
  }
  return t;
}

export const ElementView = memo(function ElementView({ el, idPrefix = "m", interactive, inert, asset, pattern, uploadUrl, pending, asImage }: ElProps) {
  const w = el.width;
  const h = el.height;
  let content: React.ReactNode = null;

  switch (el.type) {
    case "asset":
      if (uploadUrl) {
        content = <image href={uploadUrl} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />;
      } else if (asset) {
        const tint = el.tint ?? asset.defaultTint ?? "#444444";
        const img = asImage ? assetImage(asset, tint) : null;
        content = img ? (
          <image href={img.url} x={img.x * w} y={img.y * h} width={img.w * w} height={img.h * h} preserveAspectRatio="none" />
        ) : (
          <svg
            x={0}
            y={0}
            width={w}
            height={h}
            viewBox={asset.viewBox}
            preserveAspectRatio="none"
            overflow="visible"
            style={{ color: tint }}
            dangerouslySetInnerHTML={{ __html: asset.body }}
          />
        );
      } else if (pending && !el.assetId.startsWith("u:")) {
        content = <rect width={w} height={h} fill="none" />;
      } else {
        content = (
          <g>
            <rect width={w} height={h} fill="#ffffff" fillOpacity={0.5} stroke="#c0392b" strokeDasharray="6 4" strokeWidth={2} />
            <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(w, h) * 0.5} fill="#c0392b">
              ?
            </text>
          </g>
        );
      }
      break;
    case "rect":
      content = (
        <rect
          width={w}
          height={h}
          rx={el.radius || 0}
          fill={el.fill}
          fillOpacity={el.fillOpacity}
          stroke={el.strokeWidth > 0 ? el.stroke : "none"}
          strokeWidth={el.strokeWidth}
        />
      );
      break;
    case "ellipse":
      content = (
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2}
          ry={h / 2}
          fill={el.fill}
          fillOpacity={el.fillOpacity}
          stroke={el.strokeWidth > 0 ? el.stroke : "none"}
          strokeWidth={el.strokeWidth}
        />
      );
      break;
    case "text": {
      const lines = el.text.split("\n");
      content = (
        <text
          fontSize={el.fontSize}
          fontFamily={FONT_STACKS[el.fontFamily]}
          fontWeight={el.bold ? "bold" : "normal"}
          fontStyle={el.italic ? "italic" : "normal"}
          fill={el.color}
          stroke={el.outline || "none"}
          strokeWidth={el.outline ? el.fontSize * 0.14 : 0}
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{ whiteSpace: "pre" }}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={0} y={el.fontSize * (0.9 + i * LINE_HEIGHT)}>
              {line || " "}
            </tspan>
          ))}
        </text>
      );
      break;
    }
    case "path": {
      const d = cachedPathD(el.points, el.closed);
      content = (
        <>
          <path
            d={d}
            pointerEvents={interactive ? "none" : undefined}
            fill={el.closed && el.fill ? el.fill : "none"}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {interactive && (
            <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(el.strokeWidth, 14)} />
          )}
        </>
      );
      break;
    }
    case "brush":
      content = <BrushView el={el} uid={`${idPrefix}-${el.id}`} idPrefix={idPrefix} pattern={pattern} textureUrl={uploadUrl} interactive={interactive} />;
      break;
  }

  return (
    <g
      transform={elementTransform(el)}
      opacity={el.opacity < 1 ? el.opacity : undefined}
      data-el={interactive ? el.id : undefined}
      pointerEvents={interactive && inert ? "none" : undefined}
    >
      {interactive && el.type !== "path" && el.type !== "brush" ? (
        <>
          {/* Hit testing only looks at the plain box, never inside the drawing (much cheaper). */}
          <g pointerEvents="none">{content}</g>
          <rect width={w} height={h} fill="transparent" />
        </>
      ) : (
        content
      )}
    </g>
  );
});

/**
 * A painted element. Without eraser passes it is plain SVG strokes: edge colour, then paint
 * colour, then texture. With eraser passes every pass is drawn into a mask (white = paint,
 * black = eraser, in order) that reveals the colour / texture, with a wider mask below it for
 * the edge. Textures are anchored to the map, so strokes that touch continue seamlessly.
 */
function BrushView({
  el,
  uid,
  idPrefix,
  pattern,
  textureUrl,
  interactive,
}: {
  el: BrushElement;
  uid: string;
  idPrefix: string;
  pattern?: PatternDef;
  textureUrl?: string;
  interactive?: boolean;
}) {
  const w = el.width;
  const h = el.height;
  const spread = featherOf(el.softness, mainSize(el));
  // Filter regions are in user space: a straight horizontal stroke has a zero-height bbox.
  const edge = el.edge && el.edgeWidth ? el.edgeWidth : 0;
  const ts = el.textureSize || 70;
  const hasTexture = !!el.texture && (!!pattern || !!textureUrl);
  const paths = el.ops.map((o) => cachedSmoothD(o.points));
  // Only the hit paths take part in hit testing - stroked curves are expensive to test.
  const round3 = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round", pointerEvents: interactive ? "none" : undefined } as const;

  // Library textures: the drawing lives once per map in a shared template (<TextureDefs>);
  // each stroke only adds a tiny pattern that re-uses it, anchored to the map.
  const texture =
    hasTexture &&
    (pattern ? (
      <pattern
        id={`${uid}-p`}
        href={`#${textureTemplateId(idPrefix, pattern.id)}`}
        patternUnits="userSpaceOnUse"
        width={pattern.size}
        height={pattern.size}
        patternTransform={`translate(${round(-el.x)} ${round(-el.y)}) scale(${ts / pattern.size})`}
      />
    ) : (
      <pattern id={`${uid}-p`} patternUnits="userSpaceOnUse" width={ts} height={ts} patternTransform={`translate(${round(-el.x)} ${round(-el.y)})`}>
        <image href={textureUrl} width={ts} height={ts} preserveAspectRatio="xMidYMid slice" />
      </pattern>
    ));
  const hit = interactive && (
    <g {...round3} stroke="transparent" pointerEvents={undefined}>
      {el.ops.map((o, i) => (o.erase ? null : <path key={i} d={paths[i]} strokeWidth={Math.max(o.size + edge * 2, 12)} />))}
    </g>
  );

  // Nothing erased: plain strokes - far cheaper for the browser to draw and to repaint while
  // panning or zooming than masks. Soft edges blur the solid colours only; the texture sits on
  // the solid core, so it is painted once and stays sharp.
  const std = round((spread * 2) / 3);
  const filters = std > 0.2 && (
    <>
      <filter id={`${uid}-f`} filterUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
        <feGaussianBlur stdDeviation={std} />
      </filter>
      {edge > 0 && (
        <filter id={`${uid}-fi`} filterUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          <feGaussianBlur stdDeviation={round(std * 0.35)} />
        </filter>
      )}
    </>
  );
  const outer = filters ? `url(#${uid}-f)` : undefined;
  const inner = filters ? `url(#${uid}-${edge > 0 ? "fi" : "f"})` : undefined;
  if (!el.ops.some((o) => o.erase)) {
    const strokes = (paint: string, extra: number, filter: string | undefined, shrink = 0) => (
      <g {...round3} stroke={paint} filter={filter}>
        {el.ops.map((o, i) => (
          <path key={i} d={paths[i]} strokeWidth={round(Math.max(0.5, o.size + extra - shrink))} />
        ))}
      </g>
    );
    const core = filters ? (edge > 0 ? std * 0.7 : std * 2) : 0;
    return (
      <>
        {(texture || filters) && (
          <defs>
            {filters}
            {texture}
          </defs>
        )}
        {edge > 0 && strokes(el.edge!, edge * 2, outer)}
        {strokes(el.color, 0, inner)}
        {texture && strokes(`url(#${uid}-p)`, 0, undefined, core)}
        {hit}
      </>
    );
  }

  // Erased parts need a mask: white = paint, black = eraser, in order, feathered by a blur.
  const mask = (extra: number, filter: string | undefined) => (
    <g {...round3} filter={filter}>
      {el.ops.map((o, i) => (
        <path key={i} d={paths[i]} stroke={o.erase ? "#000" : "#fff"} strokeWidth={o.erase ? o.size : o.size + extra} />
      ))}
    </g>
  );
  return (
    <>
      <defs>
        {filters}
        <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          {mask(0, inner)}
        </mask>
        {edge > 0 && (
          <mask id={`${uid}-e`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
            {mask(edge * 2, outer)}
          </mask>
        )}
        {texture}
      </defs>
      <g pointerEvents={interactive ? "none" : undefined}>
        {edge > 0 && <rect width={w} height={h} fill={el.edge!} mask={`url(#${uid}-e)`} />}
        <rect width={w} height={h} fill={el.color} mask={`url(#${uid}-m)`} />
        {texture && <rect width={w} height={h} fill={`url(#${uid}-p)`} mask={`url(#${uid}-m)`} />}
      </g>
      {hit}
    </>
  );
}
