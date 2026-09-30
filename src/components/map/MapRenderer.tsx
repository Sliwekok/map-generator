import { memo } from "react";
import type { AssetDef, MapContent, MapElement, PatternDef } from "@/lib/types";
import { LAYER_ORDER } from "@/lib/types";
import { FONT_STACKS, LINE_HEIGHT } from "@/lib/editor/text";
import { pathD } from "@/lib/editor/geometry";

export interface RenderLookups {
  assets: Record<string, AssetDef>;
  patterns: Record<string, PatternDef>;
  /**
   * Uploaded images by id. `null` = known to be missing (placeholder). Ids not listed yet are
   * rendered straight from their API URL, so a map never waits for file metadata.
   */
  uploads: Record<string, { url: string } | null>;
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
export function MapRenderer({ doc, idPrefix, showGrid, interactive, hiddenIds, assets, patterns, uploads }: Props) {
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
                    interactive={interactive}
                    inert={locked || !!el.locked}
                    asset={el.type === "asset" ? assets[el.assetId] : undefined}
                    uploadUrl={
                      el.type === "asset" && el.assetId.startsWith("u:") ? uploadUrlOf(uploads, el.assetId.slice(2)) : undefined
                    }
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

interface ElProps {
  el: MapElement;
  interactive?: boolean;
  inert: boolean;
  asset?: AssetDef;
  uploadUrl?: string;
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

export const ElementView = memo(function ElementView({ el, interactive, inert, asset, uploadUrl }: ElProps) {
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
  }

  return (
    <g
      transform={elementTransform(el)}
      opacity={el.opacity < 1 ? el.opacity : undefined}
      data-el={interactive ? el.id : undefined}
      pointerEvents={interactive && inert ? "none" : undefined}
    >
      {content}
      {interactive && el.type !== "path" && <rect width={w} height={h} fill="transparent" />}
    </g>
  );
});
