import { memo } from "react";
import type { AssetDef, BrushElement, MapContent, MapElement, PatternDef } from "@/lib/types";
import { LAYER_ORDER } from "@/lib/types";
import { FONT_STACKS, LINE_HEIGHT } from "@/lib/editor/text";
import { pathD } from "@/lib/editor/geometry";
import { featherOf, mainSize, smoothD } from "@/lib/editor/brushShape";

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
  hiddenIds?: ReadonlySet<string>;
}

/**
 * Renders a map in map-space coordinates (0..width, 0..height) as pure SVG.
 * Used by the editor canvas, thumbnails, the home page demo and the SVG/PNG export,
 * so what you see is exactly what you export.
 */
export function MapRenderer({ doc, idPrefix, showGrid, interactive, hiddenIds, assets, patterns, uploads, assetsPending }: Props) {
  const { width, height, background, grid } = doc;
  const pattern = background.pattern ? patterns[background.pattern] : undefined;
  const tile = (grid.size || 70) * (background.patternScale || 1);
  const clipId = `${idPrefix}-clip`;
  const bgPatId = `${idPrefix}-bgpat`;
  const dotPatId = `${idPrefix}-dots`;
  const layerState = Object.fromEntries(doc.layers.map((l) => [l.id, l]));

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
        {pattern && (
          <pattern id={bgPatId} patternUnits="userSpaceOnUse" width={tile} height={tile}>
            <svg
              width={tile}
              height={tile}
              viewBox={`0 0 ${pattern.size} ${pattern.size}`}
              preserveAspectRatio="none"
              dangerouslySetInnerHTML={{ __html: pattern.body }}
            />
          </pattern>
        )}
        {showGrid && grid.enabled && grid.style === "dots" && (
          <pattern id={dotPatId} patternUnits="userSpaceOnUse" width={grid.size} height={grid.size}>
            <circle cx={0} cy={0} r={grid.lineWidth * 1.6} fill={grid.color} />
            <circle cx={grid.size} cy={0} r={grid.lineWidth * 1.6} fill={grid.color} />
            <circle cx={0} cy={grid.size} r={grid.lineWidth * 1.6} fill={grid.color} />
            <circle cx={grid.size} cy={grid.size} r={grid.lineWidth * 1.6} fill={grid.color} />
          </pattern>
        )}
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={0} y={0} width={width} height={height} fill={background.color} data-bg={interactive ? "1" : undefined} />
        {pattern && <rect x={0} y={0} width={width} height={height} fill={`url(#${bgPatId})`} pointerEvents="none" />}
        {LAYER_ORDER.map((layerId) => {
          const ls = layerState[layerId];
          if (ls && !ls.visible) return null;
          const locked = !!ls?.locked;
          return (
            <g key={layerId} data-layer={layerId}>
              {doc.elements.map((el) =>
                el.layer === layerId && !hiddenIds?.has(el.id) ? (
                  <ElementView
                    key={el.id}
                    el={el}
                    idPrefix={idPrefix}
                    interactive={interactive}
                    inert={locked || !!el.locked}
                    asset={el.type === "asset" ? assets[el.assetId] : undefined}
                    pattern={el.type === "brush" && el.texture && !el.texture.startsWith("u:") ? patterns[el.texture] : undefined}
                    pending={assetsPending}
                    uploadUrl={uploadRef(el) ? uploadUrlOf(uploads, uploadRef(el)!) : undefined}
                  />
                ) : null,
              )}
            </g>
          );
        })}
        {showGrid && grid.enabled && (
          <g opacity={grid.opacity} pointerEvents="none">
            {grid.style === "dots" ? (
              <rect x={0} y={0} width={width} height={height} fill={`url(#${dotPatId})`} />
            ) : (
              <path d={gridPath(width, height, grid.size)} stroke={grid.color} strokeWidth={grid.lineWidth} fill="none" />
            )}
          </g>
        )}
      </g>
    </g>
  );
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
    <ElementView
      el={el}
      idPrefix={idPrefix}
      inert
      pattern={el.type === "brush" && el.texture && !el.texture.startsWith("u:") ? patterns[el.texture] : undefined}
      uploadUrl={ref ? uploadUrlOf(uploads, ref) : undefined}
    />
  );
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

export const ElementView = memo(function ElementView({ el, idPrefix = "m", interactive, inert, asset, pattern, uploadUrl, pending }: ElProps) {
  const w = el.width;
  const h = el.height;
  let content: React.ReactNode = null;

  switch (el.type) {
    case "asset":
      if (uploadUrl) {
        content = <image href={uploadUrl} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />;
      } else if (asset) {
        content = (
          <svg
            x={0}
            y={0}
            width={w}
            height={h}
            viewBox={asset.viewBox}
            preserveAspectRatio="none"
            overflow="visible"
            style={{ color: el.tint ?? asset.defaultTint ?? "#444444" }}
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
      const d = pathD(el.points, el.closed);
      content = (
        <>
          <path
            d={d}
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
      content = <BrushView el={el} uid={`${idPrefix}-${el.id}`} pattern={pattern} textureUrl={uploadUrl} interactive={interactive} />;
      break;
  }

  return (
    <g
      transform={elementTransform(el)}
      opacity={el.opacity < 1 ? el.opacity : undefined}
      data-el={interactive ? el.id : undefined}
      pointerEvents={interactive && inert ? "none" : undefined}
    >
      {content}
      {interactive && el.type !== "path" && el.type !== "brush" && <rect width={w} height={h} fill="transparent" />}
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
  pattern,
  textureUrl,
  interactive,
}: {
  el: BrushElement;
  uid: string;
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
  const paths = el.ops.map((o) => smoothD(o.points));
  const round3 = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

  const texture = hasTexture && (
    <pattern id={`${uid}-p`} patternUnits="userSpaceOnUse" width={ts} height={ts} patternTransform={`translate(${round(-el.x)} ${round(-el.y)})`}>
      {pattern ? (
        <svg width={ts} height={ts} viewBox={`0 0 ${pattern.size} ${pattern.size}`} preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: pattern.body }} />
      ) : (
        <image href={textureUrl} width={ts} height={ts} preserveAspectRatio="xMidYMid slice" />
      )}
    </pattern>
  );
  const hit = interactive && (
    <g {...round3} stroke="transparent">
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
      {edge > 0 && <rect width={w} height={h} fill={el.edge!} mask={`url(#${uid}-e)`} />}
      <rect width={w} height={h} fill={el.color} mask={`url(#${uid}-m)`} />
      {texture && <rect width={w} height={h} fill={`url(#${uid}-p)`} mask={`url(#${uid}-m)`} />}
      {hit}
    </>
  );
}
