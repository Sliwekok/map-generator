"use client";

import { useMemo, useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useAssets } from "@/lib/client/assets";
import { useSession } from "@/lib/client/session";
import { useUploads } from "@/lib/client/uploads";
import { useEditor } from "@/lib/editor/store";
import { useBrush, BRUSH_LIMITS } from "@/lib/editor/brushStore";
import {
  BRUSH_PRESETS,
  brushPx,
  fitBrushBox,
  mainSize,
  presetSettings,
  resizePasses,
  restyleBrush,
  type BrushPreset,
  type BrushSettings,
  type PresetGroup,
  type ScatterRotate,
} from "@/lib/editor/brush";
import { lineTakesAccent, lineTakesEdge, lineTakesSpacing, lineTakesTexture } from "@/lib/editor/brushLines";
import { clearMask, eraserTargets, erasedPasses } from "@/lib/editor/mask";
import { useItemLabel } from "@/lib/editor/itemLabel";
import {
  BRUSH_LINES,
  LAYER_ORDER,
  type AssetDef,
  type AssetElement,
  type BrushElement,
  type BrushLine,
  type LayerId,
  type MapElement,
  type PatternDef,
} from "@/lib/types";
import { ElementPreview } from "@/components/map/MapRenderer";
import FileBrowser from "@/components/files/FileBrowser";
import { Icon } from "@/components/ui/Icon";
import { Button, ColorField, cx, Label, NumberField, Segmented, Slider } from "@/components/ui/controls";
import { LibraryStatus, PatternSwatch, TextureGrid } from "./libraryParts";

const DEFAULT_ACCENT = "#4a3826";

const SWATCHES = ["#3f7fb5", "#1e4e79", "#6fb3d9", "#a07d52", "#6b4f2f", "#e3cf96", "#7fae4e", "#3d6b35", "#e8590c", "#8d8173", "#3d3a36", "#f1f5f9"];

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Can the current user paint with this texture? (library pattern they can load, or their own upload) */
function useCanUse() {
  const patterns = useAssets((s) => s.patternsById);
  const { user } = useSession();
  return (texture: string) => (texture.startsWith("u:") ? !!user : !!patterns[texture]);
}

/** Can the current user stamp this library graphic? (only usable groups come with their drawings) */
function useCanUseAsset() {
  const assets = useAssets((s) => s.byId);
  return (id: string) => !!assets[id];
}

// ---------------------------------------------------------------------------
// Tool settings (right panel while the brush or eraser is active)
// ---------------------------------------------------------------------------

export function BrushToolPanel() {
  const { t } = useI18n();
  const tool = useEditor((s) => s.tool);
  const grid = useEditor((s) => s.doc?.grid.size || 70);
  const b = useBrush((s) => s.settings);
  const set = useBrush((s) => s.set);
  const cells = (v: number) => t("editor.brush.cells", { n: Math.round(v * 100) / 100, px: Math.round(brushPx(v, grid)) });

  if (tool === "eraser") {
    return (
      <div data-testid="eraser-panel">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Icon name="eraser" size={16} /> {t("editor.brush.eraserTitle")}
        </h3>
        <Section title={t("editor.brush.size")} right={<span className="text-[11px] text-slate-400">{cells(b.eraserSize)}</span>}>
          <SizeControl value={b.eraserSize} onChange={(v) => set({ eraserSize: v })} />
        </Section>
        <GraphicEraser />
        <Button className="w-full" onClick={() => useEditor.getState().setTool("brush")}>
          <Icon name="brush" size={16} /> {t("editor.brush.backToBrush")}
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="brush-panel">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Icon name="brush" size={16} /> {t("editor.brush.title")}
      </h3>
      <div className="mb-4" data-testid="brush-kind">
        <Segmented
          value={b.kind}
          options={[
            { value: "paint", label: t("editor.brush.kindPaint") },
            { value: "scatter", label: t("editor.brush.kindScatter") },
          ]}
          onChange={(kind) => set({ kind }, useBrush.getState().preset)}
        />
      </div>
      {b.kind === "scatter" ? <ScatterSettings /> : <PaintSettings />}
    </div>
  );
}

function PaintSettings() {
  const { t } = useI18n();
  const grid = useEditor((s) => s.doc?.grid.size || 70);
  const b = useBrush((s) => s.settings);
  const set = useBrush((s) => s.set);
  const cells = (v: number) => t("editor.brush.cells", { n: Math.round(v * 100) / 100, px: Math.round(brushPx(v, grid)) });
  const line = b.line;
  return (
    <>
      <Presets groups={["areas", "lines", "rough"]} />
      <Section title={t("editor.brush.lineStyle")}>
        <LineStylePicker value={line} color={b.color} accent={b.accent} onChange={(v) => set({ line: v })} />
        <LineOptions
          line={line}
          spacing={b.lineSpacing}
          accent={b.accent}
          flip={b.flipSide}
          onSpacing={(lineSpacing) => set({ lineSpacing })}
          onAccent={(accent) => set({ accent })}
          onFlip={(flipSide) => set({ flipSide })}
        />
      </Section>
      {line === "solid" && (
        <Section title={t("editor.brush.rough")} right={<Pct v={b.rough} />}>
          <Slider value={b.rough} onChange={(v) => set({ rough: v })} />
          <p className="mt-1 text-[11px] text-slate-500">{t("editor.brush.roughHint")}</p>
        </Section>
      )}
      <Section title={t("editor.brush.paint")}>
        <PaintPicker
          color={b.color}
          texture={lineTakesTexture(line) ? b.texture : null}
          allowTexture={lineTakesTexture(line)}
          onColor={(color) => set({ color })}
          onTexture={(texture) => set({ texture })}
          idPrefix="bt"
        />
        {b.texture && lineTakesTexture(line) && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{t("editor.brush.textureScale")}</span>
              <span>{cells(b.textureScale)}</span>
            </div>
            <Slider value={b.textureScale} min={0.25} max={6} step={0.25} onChange={(v) => set({ textureScale: v })} />
          </div>
        )}
      </Section>
      <Section title={t("editor.brush.size")} right={<span className="text-[11px] text-slate-400">{cells(b.size)}</span>}>
        <SizeControl value={b.size} onChange={(v) => set({ size: v })} />
      </Section>
      <Section title={t("editor.brush.softness")} right={<Pct v={b.softness} />}>
        <Slider value={b.softness} onChange={(v) => set({ softness: v })} />
      </Section>
      <Section title={t("editor.brush.smoothing")} right={<Pct v={b.smoothing} />}>
        <Slider value={b.smoothing} onChange={(v) => set({ smoothing: v })} />
      </Section>
      {lineTakesEdge(line) && (
        <Section title={t("editor.brush.edge")}>
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={b.edge} onChange={(e) => set({ edge: e.target.checked })} data-testid="brush-edge" />
            {t("editor.brush.edgeOn")}
          </label>
          {b.edge && (
            <>
              <ColorField value={b.edgeColor} onChange={(edgeColor) => set({ edgeColor })} />
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>{t("editor.brush.edgeWidth")}</span>
                <span>{cells(b.edgeWidth)}</span>
              </div>
              <Slider value={b.edgeWidth} min={0.01} max={0.5} step={0.01} onChange={(v) => set({ edgeWidth: v })} />
            </>
          )}
        </Section>
      )}
      <Section title={t("editor.props.opacity")} right={<Pct v={b.opacity} />}>
        <Slider value={b.opacity} min={0.05} onChange={(v) => set({ opacity: v })} />
      </Section>
      <Section title={t("editor.brush.layer")}>
        <LayerSelect value={b.layer} onChange={(layer) => set({ layer })} />
      </Section>
      <label className="mb-3 flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" className="mt-1" checked={b.merge} onChange={(e) => set({ merge: e.target.checked })} />
        <span>
          {t("editor.brush.merge")}
          <span className="block text-[11px] text-slate-500">{t("editor.brush.mergeHint")}</span>
        </span>
      </label>
      <p className="text-[11px] leading-relaxed text-slate-500">{t("editor.brush.hint")}</p>
    </>
  );
}

/** Spacing / second colour / side options of the line styles that have them. */
function LineOptions({
  line,
  spacing,
  accent,
  flip,
  onSpacing,
  onAccent,
  onFlip,
  live,
}: {
  line: BrushLine;
  spacing: number;
  accent: string;
  flip: boolean;
  onSpacing: (v: number) => void;
  onAccent: (v: string) => void;
  onFlip: (v: boolean) => void;
  /** Slider drag bounds (one undo step for a selected stroke). */
  live?: { start: () => void; end: () => void };
}) {
  const { t } = useI18n();
  if (!lineTakesSpacing(line) && !lineTakesAccent(line)) return null;
  return (
    <div className="mt-2 space-y-2">
      {lineTakesSpacing(line) && (
        <div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{t("editor.brush.lineSpacing")}</span>
            <span className="tabular-nums">{Math.round(spacing * 100)}%</span>
          </div>
          <Slider
            value={spacing}
            min={BRUSH_LIMITS.lineSpacing[0]}
            max={BRUSH_LIMITS.lineSpacing[1]}
            step={0.05}
            onStart={live?.start}
            onEnd={live?.end}
            onChange={onSpacing}
          />
        </div>
      )}
      {lineTakesAccent(line) && (
        <div>
          <div className="mb-1 text-xs text-slate-400">{t(line === "rail" ? "editor.brush.accentTies" : "editor.brush.accentPosts")}</div>
          <ColorField value={accent} onChange={onAccent} />
        </div>
      )}
      {line === "cliff" && (
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={flip} onChange={(e) => onFlip(e.target.checked)} data-testid="brush-flip-side" />
          {t("editor.brush.flipSide")}
        </label>
      )}
    </div>
  );
}

/** Size of the sample stroke drawn on each line-style button (in its 60 × 30 box). */
const SAMPLE_SIZE: Record<BrushLine, number> = { solid: 8, dashed: 4, dotted: 4, double: 9, rail: 10, fence: 7, cliff: 10 };
const SAMPLE_PTS: [number, number][] = [
  [6, 21],
  [22, 9],
  [38, 21],
  [54, 9],
];

/** A tiny stroke drawn by the real renderer, so buttons look exactly like what gets painted. */
function BrushSample({ style, id }: { style: Partial<BrushElement>; id: string }) {
  const patterns = useAssets((s) => s.patternsById);
  const line = style.line;
  const el: BrushElement = {
    id: `sample-${id}`,
    type: "brush",
    x: 0,
    y: 0,
    width: 60,
    height: 30,
    rotation: 0,
    opacity: 1,
    layer: "terrain",
    color: "#3d3a36",
    ...style,
    textureSize: style.texture ? 20 : undefined,
    ops: [{ size: SAMPLE_SIZE[line ?? "solid"] * (style.rough ? 1.3 : 1), points: SAMPLE_PTS }],
  };
  return (
    <svg viewBox="0 0 60 30" className="h-7 w-full rounded bg-[#e8dcc0]">
      <ElementPreview el={el} idPrefix={`bs-${id}`} patterns={patterns} uploads={{}} />
    </svg>
  );
}

function LineStylePicker({ value, color, accent, onChange }: { value: BrushLine; color: string; accent: string; onChange: (v: BrushLine) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-4 gap-1.5" data-testid="line-styles">
      {BRUSH_LINES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          data-line={l}
          aria-pressed={value === l}
          title={t(`editor.brush.lines.${l}` as TKey)}
          className={cx("flex flex-col items-center gap-0.5 rounded-lg bg-slate-800 p-1 ring-2", value === l ? "ring-amber-500" : "ring-transparent hover:ring-slate-600")}
        >
          <BrushSample id={`ls-${l}`} style={{ line: l === "solid" ? undefined : l, color, accent }} />
          <span className="w-full truncate text-center text-[10px] text-slate-300">{t(`editor.brush.lines.${l}` as TKey)}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scatter brush
// ---------------------------------------------------------------------------

function ScatterSettings() {
  const { t } = useI18n();
  const grid = useEditor((s) => s.doc?.grid.size || 70);
  const b = useBrush((s) => s.settings);
  const set = useBrush((s) => s.set);
  const cells = (v: number) => t("editor.brush.cells", { n: Math.round(v * 100) / 100, px: Math.round(v * grid) });
  return (
    <div data-testid="scatter-panel">
      <Presets groups={["scatter"]} />
      <Section title={t("editor.brush.scatterGraphics")}>
        <ScatterPicker />
      </Section>
      <Section title={t("editor.brush.scatterScale")} right={<Pct v={b.scatterScale} />}>
        <Slider value={b.scatterScale} min={BRUSH_LIMITS.scatterScale[0]} max={BRUSH_LIMITS.scatterScale[1]} step={0.05} onChange={(v) => set({ scatterScale: v })} />
      </Section>
      <Section title={t("editor.brush.scatterJitter")} right={<Pct v={b.scatterJitter} />}>
        <Slider value={b.scatterJitter} onChange={(v) => set({ scatterJitter: v })} />
      </Section>
      <Section title={t("editor.brush.scatterSpacing")} right={<Pct v={b.scatterSpacing} />}>
        <Slider value={b.scatterSpacing} min={BRUSH_LIMITS.scatterSpacing[0]} max={BRUSH_LIMITS.scatterSpacing[1]} step={0.05} onChange={(v) => set({ scatterSpacing: v })} />
        <p className="mt-1 text-[11px] text-slate-500">{t("editor.brush.scatterSpacingHint")}</p>
      </Section>
      <Section title={t("editor.brush.scatterSpread")} right={<span className="text-[11px] text-slate-400">{cells(b.scatterSpread)}</span>}>
        <Slider value={b.scatterSpread} min={0} max={6} step={0.05} onChange={(v) => set({ scatterSpread: v })} />
      </Section>
      <Section title={t("editor.brush.scatterRotate")}>
        <Segmented<ScatterRotate>
          value={b.scatterRotate}
          options={[
            { value: "random", label: t("editor.brush.rotateRandom") },
            { value: "follow", label: t("editor.brush.rotateFollow") },
            { value: "none", label: t("editor.brush.rotateNone") },
          ]}
          onChange={(scatterRotate) => set({ scatterRotate })}
        />
      </Section>
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={b.scatterFlip} onChange={(e) => set({ scatterFlip: e.target.checked })} />
        {t("editor.brush.scatterFlip")}
      </label>
      <Section title={t("editor.brush.smoothing")} right={<Pct v={b.smoothing} />}>
        <Slider value={b.smoothing} onChange={(v) => set({ smoothing: v })} />
      </Section>
      <Section title={t("editor.props.opacity")} right={<Pct v={b.opacity} />}>
        <Slider value={b.opacity} min={0.05} onChange={(v) => set({ opacity: v })} />
      </Section>
      <Section title={t("editor.brush.layer")}>
        <LayerSelect value={b.scatterLayer} auto onChange={(scatterLayer) => set({ scatterLayer })} />
      </Section>
      <p className="text-[11px] leading-relaxed text-slate-500">{t("editor.brush.scatterHint")}</p>
    </div>
  );
}

function AssetIcon({ asset }: { asset: AssetDef }) {
  return (
    <svg viewBox={asset.viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet" style={{ color: asset.defaultTint ?? "#444" }}>
      <g dangerouslySetInnerHTML={{ __html: asset.body }} />
    </svg>
  );
}

/** Graphics the scatter brush picks from: the chosen ones, and a searchable list to add more. */
function ScatterPicker() {
  const { t, lang } = useI18n();
  const status = useAssets((s) => s.status);
  const all = useAssets((s) => s.assets);
  const byId = useAssets((s) => s.byId);
  const chosen = useBrush((s) => s.settings.scatter);
  const set = useBrush((s) => s.set);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const needle = q.trim().toLowerCase();
  const list = useMemo(
    () =>
      all.filter(
        (a) =>
          !a.hidden &&
          (!needle || a.name.en.toLowerCase().includes(needle) || a.name.pl.toLowerCase().includes(needle) || !!a.tags?.some((x) => x.includes(needle))),
      ),
    [all, needle],
  );
  const usable = chosen.filter((id) => byId[id]);
  const missing = chosen.length - usable.length;
  const full = chosen.length >= BRUSH_LIMITS.scatterAssets;
  const toggle = (id: string) => {
    const has = chosen.includes(id);
    if (!has && full) return;
    set({ scatter: has ? chosen.filter((x) => x !== id) : [...chosen, id] });
  };
  const shown = showAll || needle ? list : list.slice(0, 36);

  return (
    <div className="space-y-2">
      {usable.length ? (
        <div className="flex flex-wrap gap-1.5" data-testid="scatter-selected">
          {usable.map((id) => (
            <span key={id} className="flex items-center gap-1 rounded-md bg-slate-800 py-0.5 pl-0.5 pr-1 ring-1 ring-slate-700" data-scatter={id}>
              <span className="h-6 w-6 overflow-hidden rounded bg-[#e8dcc0]">
                <AssetIcon asset={byId[id]} />
              </span>
              <span className="max-w-[5.5rem] truncate text-[11px] text-slate-200">{byId[id].name[lang]}</span>
              <button type="button" onClick={() => toggle(id)} title={t("editor.brush.scatterRemove")} className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100">
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-amber-200" data-testid="scatter-empty">
          {t("editor.brush.scatterNone")}
        </p>
      )}
      {missing > 0 && <p className="text-[11px] text-slate-500">{t("editor.brush.scatterMissing", { n: missing })}</p>}
      <div className="rounded-lg bg-slate-800/60 p-2 ring-1 ring-slate-700">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 text-left text-xs font-semibold text-slate-300"
          data-testid="scatter-choose"
        >
          <Icon name={open ? "chevronDown" : "chevronRight"} size={14} className="text-slate-500" />
          <span className="flex-1">{t("editor.brush.scatterChoose")}</span>
          <span className="text-[10px] font-normal text-slate-500">
            {chosen.length}/{BRUSH_LIMITS.scatterAssets}
          </span>
        </button>
        {open && (
          <div className="mt-2 space-y-2">
            {status !== "ready" && <LibraryStatus />}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("editor.library.search")}
              className="w-full rounded-md bg-slate-900 px-2 py-1.5 text-xs text-slate-100 ring-1 ring-slate-700 outline-none focus:ring-amber-500"
            />
            <div className="grid grid-cols-4 gap-1.5" data-testid="scatter-library">
              {shown.map((a) => {
                const on = chosen.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    title={a.name[lang]}
                    data-asset-id={a.id}
                    aria-pressed={on}
                    disabled={!on && full}
                    className={cx(
                      "relative h-12 overflow-hidden rounded bg-[#e8dcc0] p-0.5 ring-2 disabled:opacity-40",
                      on ? "ring-amber-500" : "ring-transparent hover:ring-slate-500",
                    )}
                  >
                    <AssetIcon asset={a} />
                    {on && <Icon name="check" size={12} className="absolute right-0.5 top-0.5 rounded bg-amber-500 text-slate-950" />}
                  </button>
                );
              })}
            </div>
            {!needle && !showAll && list.length > shown.length && (
              <button type="button" onClick={() => setShowAll(true)} className="w-full rounded-md bg-slate-800 py-1 text-xs text-slate-300 hover:bg-slate-700">
                {t("editor.library.showAll", { n: list.length })}
              </button>
            )}
            {status === "ready" && !list.length && <p className="text-xs text-slate-500">{t("editor.library.noResults")}</p>}
            <p className="text-[11px] text-slate-500">{t("editor.brush.scatterLockedHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Eraser settings for the selected images / graphics (erase or paint back, softness), or the
 * hint for brush strokes when no graphic is selected.
 */
function GraphicEraser() {
  const { t } = useI18n();
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const b = useBrush((s) => s.settings);
  const set = useBrush((s) => s.set);
  const label = useItemLabel();
  const { graphics, editable } = eraserTargets(doc, selection);

  if (!graphics.length) {
    return (
      <>
        <p className="mb-2 text-xs leading-relaxed text-slate-400">{t("editor.brush.eraserHint")}</p>
        <p className="mb-4 text-xs leading-relaxed text-slate-500" data-testid="eraser-graphic-hint">
          {t("editor.brush.eraserGraphicHint")}
        </p>
      </>
    );
  }
  const erased = editable.reduce((n, g) => n + erasedPasses(g), 0);
  return (
    <div data-testid="eraser-graphics">
      <div className="mb-3 rounded-lg bg-slate-800 p-2 ring-1 ring-slate-700">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{t("editor.brush.eraserTarget")}</div>
        <div className="truncate text-sm text-slate-200" data-testid="eraser-target">
          {graphics.length === 1 ? label(graphics[0]).name : t("editor.brush.eraserTargets", { n: graphics.length })}
        </div>
        {editable.length < graphics.length && (
          <p className="mt-1 text-[11px] text-red-300">{t("editor.brush.eraserSomeLocked", { n: graphics.length - editable.length })}</p>
        )}
      </div>
      <Section title={t("editor.brush.eraserMode")}>
        <Segmented
          value={b.eraserRestore ? "restore" : "erase"}
          options={[
            { value: "erase", label: t("editor.brush.modeErase") },
            { value: "restore", label: t("editor.brush.modeRestore") },
          ]}
          onChange={(v) => set({ eraserRestore: v === "restore" })}
        />
      </Section>
      <Section title={t("editor.brush.softness")} right={<Pct v={b.eraserSoftness} />}>
        <Slider value={b.eraserSoftness} onChange={(v) => set({ eraserSoftness: v })} />
      </Section>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">{t("editor.brush.eraserGraphicsHint")}</p>
      <div className="mb-3 flex flex-col gap-2">
        {erased > 0 && (
          <Button
            className="w-full"
            onClick={() => {
              const ids = new Set(editable.map((g) => g.id));
              useEditor.getState().updateElements([...ids], (e) => (e.type === "asset" ? clearMask(e) : e));
            }}
            data-testid="graphic-restore-all"
          >
            <Icon name="undo" size={16} /> {t("editor.brush.restoreGraphic", { n: erased })}
          </Button>
        )}
        <Button className="w-full" onClick={() => useEditor.getState().select([])} data-testid="eraser-deselect">
          <Icon name="x" size={16} /> {t("editor.brush.eraseStrokesInstead")}
        </Button>
      </div>
    </div>
  );
}

/** Properties of a selected image / graphic: erase parts of it, or show everything again. */
export function GraphicMaskProps({ el }: { el: AssetElement }) {
  const { t } = useI18n();
  const erased = erasedPasses(el);
  return (
    <Section title={t("editor.brush.erasedParts")}>
      <div className="flex flex-col gap-2">
        <Button className="w-full" onClick={() => useEditor.getState().setTool("eraser")} data-testid="graphic-erase">
          <Icon name="eraser" size={16} /> {t("editor.brush.eraseParts")}
        </Button>
        {erased > 0 && (
          <Button
            className="w-full"
            onClick={() => useEditor.getState().updateElements([el.id], (e) => (e.type === "asset" ? clearMask(e) : e))}
            data-testid="graphic-restore"
          >
            <Icon name="undo" size={16} /> {t("editor.brush.restoreGraphic", { n: erased })}
          </Button>
        )}
      </div>
    </Section>
  );
}

function Pct({ v }: { v: number }) {
  return <span className="text-[11px] tabular-nums text-slate-400">{Math.round(v * 100)}%</span>;
}

/** Slider for common sizes plus an exact field (grid cells). */
function SizeControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Slider value={Math.min(value, 4)} min={0.05} max={4} step={0.05} onChange={onChange} />
      </div>
      <NumberField
        className="w-20"
        value={value}
        min={BRUSH_LIMITS.size[0]}
        max={BRUSH_LIMITS.size[1]}
        step={0.05}
        suffix={t("editor.brush.cellsShort")}
        onChange={onChange}
      />
    </div>
  );
}

function LayerSelect<T extends LayerId | "auto">({ value, onChange, auto }: { value: T; onChange: (l: T) => void; auto?: boolean }) {
  const { t } = useI18n();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-md bg-slate-800 px-2 py-1.5 text-sm text-slate-100 ring-1 ring-slate-700"
      data-testid="brush-layer"
    >
      {auto && <option value="auto">{t("editor.brush.layerAuto")}</option>}
      {LAYER_ORDER.map((l) => (
        <option key={l} value={l}>
          {t(`editor.layers.${l}` as TKey)}
        </option>
      ))}
    </select>
  );
}

function Presets({ groups }: { groups: PresetGroup[] }) {
  const { t } = useI18n();
  const active = useBrush((s) => s.preset);
  const patterns = useAssets((s) => s.patternsById);
  const assets = useAssets((s) => s.byId);
  const canUse = useCanUse();
  const canUseAsset = useCanUseAsset();
  const apply = (p: BrushPreset) => {
    const settings = presetSettings(p, canUse, canUseAsset);
    if (settings) useBrush.getState().set(settings, p.id);
  };
  return (
    <Section title={t("editor.brush.presets")}>
      {groups.map((g) => (
        <div key={g} className="mb-2" data-testid={`presets-${g}`}>
          {groups.length > 1 && <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{t(`editor.brush.presetGroups.${g}` as TKey)}</div>}
          <div className="grid grid-cols-3 gap-1.5">
            {BRUSH_PRESETS.filter((p) => p.group === g).map((p) => {
              const scatter = p.group === "scatter";
              const usableAssets = scatter ? (p.assets ?? []).filter(canUseAsset) : [];
              const tex = p.textures.find(canUse);
              const unavailable = scatter && !usableAssets.length;
              const wantsLocked = scatter ? usableAssets.length < (p.assets ?? []).length : p.textures.length > 0 && !tex;
              const name = t(`editor.brush.presetNames.${p.id}` as TKey);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => apply(p)}
                  disabled={unavailable}
                  data-preset={p.id}
                  aria-pressed={active === p.id}
                  title={unavailable ? t("editor.brush.presetScatterLocked") : wantsLocked ? t(scatter ? "editor.brush.presetScatterPartial" : "editor.brush.presetLocked") : name}
                  className={cx(
                    "relative flex flex-col items-center gap-0.5 rounded-lg bg-slate-800 p-1 ring-2 disabled:cursor-not-allowed disabled:opacity-50",
                    active === p.id ? "ring-amber-500" : "ring-transparent hover:ring-slate-600",
                  )}
                >
                  {scatter ? (
                    <span className="flex h-7 w-full items-center justify-center gap-0.5 rounded bg-[#e8dcc0]">
                      {(usableAssets.length ? usableAssets : []).slice(0, 3).map((id) => (
                        <span key={id} className="h-6 w-6">
                          <AssetIcon asset={assets[id]} />
                        </span>
                      ))}
                    </span>
                  ) : g === "areas" ? (
                    <MiniStroke color={p.settings.color!} edge={p.settings.edge ? p.settings.edgeColor! : null} pattern={tex ? patterns[tex] : undefined} id={p.id} />
                  ) : (
                    <BrushSample
                      id={`pr-${p.id}`}
                      style={{
                        line: p.settings.line === "solid" ? undefined : p.settings.line,
                        color: p.settings.color,
                        accent: p.settings.accent,
                        rough: p.settings.rough,
                        texture: tex ?? null,
                        edge: p.settings.edge ? p.settings.edgeColor : null,
                        edgeWidth: p.settings.edge ? 1.5 : undefined,
                      }}
                    />
                  )}
                  <span className="w-full truncate text-center text-[10px] text-slate-300">{name}</span>
                  {wantsLocked && <Icon name="lock" size={10} className="absolute right-1 top-1 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Section>
  );
}

/** Tiny sample stroke for preset buttons. */
function MiniStroke({ color, edge, pattern, id }: { color: string; edge: string | null; pattern?: PatternDef; id: string }) {
  const d = "M6 22C16 4 30 30 54 10";
  const pid = `mini-${id}`;
  return (
    <svg viewBox="0 0 60 30" className="h-7 w-full rounded bg-[#e8dcc0]">
      {pattern && (
        <defs>
          <pattern id={pid} width={20} height={20} patternUnits="userSpaceOnUse">
            <svg width={20} height={20} viewBox={`0 0 ${pattern.size} ${pattern.size}`} preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: pattern.body }} />
          </pattern>
        </defs>
      )}
      {edge && <path d={d} fill="none" stroke={edge} strokeWidth={11} strokeLinecap="round" />}
      <path d={d} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
      {pattern && <path d={d} fill="none" stroke={`url(#${pid})`} strokeWidth={8} strokeLinecap="round" />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Paint picker: colour, library texture, or an image from My files
// ---------------------------------------------------------------------------

export function PaintPicker({
  color,
  texture,
  onColor,
  onTexture,
  idPrefix,
  allowTexture = true,
}: {
  color: string;
  texture: string | null | undefined;
  onColor: (c: string) => void;
  onTexture: (t: string | null) => void;
  idPrefix: string;
  /** False for line styles drawn in colour only (the texture tab is hidden). */
  allowTexture?: boolean;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const status = useAssets((s) => s.status);
  const [mode, setMode] = useState<"color" | "texture">(texture ? "texture" : "color");
  const [filesOpen, setFilesOpen] = useState(false);
  const shown = !allowTexture ? "color" : texture ? "texture" : mode;

  return (
    <div className="space-y-2" data-testid={`${idPrefix}-paint`}>
      {!allowTexture && <p className="text-[11px] text-slate-500">{t("editor.brush.colorOnly")}</p>}
      {allowTexture && <Segmented
        value={shown}
        onChange={(m) => {
          setMode(m);
          if (m === "color") onTexture(null);
        }}
        options={[
          { value: "color", label: t("editor.brush.color") },
          { value: "texture", label: t("editor.brush.texture") },
        ]}
      />}
      <div>
        {shown === "texture" && <div className="mb-1 text-xs text-slate-400">{t("editor.brush.baseColor")}</div>}
        <div className="flex flex-wrap items-center gap-1.5">
          <ColorField value={color} onChange={onColor} />
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColor(c)}
              title={c}
              className={cx("h-5 w-5 rounded-full ring-1", color.toLowerCase() === c ? "ring-2 ring-amber-400" : "ring-slate-600")}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      {shown === "texture" && (
        <div className="space-y-2">
          <CurrentTexture texture={texture} idPrefix={idPrefix} onClear={() => onTexture(null)} />
          {status !== "ready" && <LibraryStatus />}
          <TextureGrid value={texture} onPick={(id) => onTexture(id)} testPrefix={`${idPrefix}-texture-group`} idPrefix={`${idPrefix}-th`} />
          <div className="rounded-lg bg-slate-800/60 p-2 ring-1 ring-slate-700">
            <button
              type="button"
              onClick={() => setFilesOpen((v) => !v)}
              aria-expanded={filesOpen}
              className="flex w-full items-center gap-1.5 text-left text-xs font-semibold text-slate-300"
            >
              <Icon name={filesOpen ? "chevronDown" : "chevronRight"} size={14} className="text-slate-500" />
              <Icon name="folder" size={14} className="text-slate-400" />
              <span className="flex-1">{t("editor.brush.fromFiles")}</span>
            </button>
            {filesOpen &&
              (user ? (
                <div className="mt-2">
                  <p className="mb-2 text-[11px] text-slate-500">{t("editor.brush.fromFilesHint")}</p>
                  <FileBrowser variant="panel" onPick={(u) => onTexture(`u:${u.id}`)} />
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-amber-200">{t("editor.brush.filesLogin")}</p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CurrentTexture({ texture, idPrefix, onClear }: { texture: string | null | undefined; idPrefix: string; onClear: () => void }) {
  const { t, lang } = useI18n();
  const patterns = useAssets((s) => s.patternsById);
  const uploads = useUploads((s) => s.byId);
  if (!texture) return <p className="text-[11px] text-slate-500">{t("editor.brush.pickTexture")}</p>;
  const up = texture.startsWith("u:") ? texture.slice(2) : null;
  const pat = up ? undefined : patterns[texture];
  const name = up ? (uploads[up]?.name ?? t("editor.layers.types.image")) : (pat?.name[lang] ?? t("editor.brush.textureMissing"));
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-800 p-1.5 ring-1 ring-amber-500/60" data-testid={`${idPrefix}-current-texture`}>
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-slate-700">
        {pat && <PatternSwatch pattern={pat} idPrefix={`${idPrefix}-cur`} />}
        {up && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={uploads[up]?.url ?? `/api/uploads/${up}`} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{name}</span>
      <button type="button" onClick={onClear} title={t("editor.brush.noTexture")} className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Properties of a selected painted element
// ---------------------------------------------------------------------------

export function BrushProps({ el }: { el: BrushElement }) {
  const { t } = useI18n();
  const grid = useEditor((s) => s.doc?.grid.size || 70);
  const s = useEditor.getState;
  const upd = (fn: (e: BrushElement) => BrushElement) => s().updateElements([el.id], (e: MapElement) => (e.type === "brush" ? fn(e) : e));
  const live = (fn: (e: BrushElement) => BrushElement) =>
    s().updateElements([el.id], (e: MapElement) => (e.type === "brush" ? fn(e) : e), { history: false });
  const size = mainSize(el);
  const erased = el.ops.filter((o) => o.erase).length;
  const passes = el.ops.length - erased;
  const line: BrushLine = el.line ?? "solid";

  return (
    <div data-testid="brush-props">
      <Section title={t("editor.brush.size")}>
        <NumberField
          suffix="px"
          min={0.5}
          max={2000}
          value={Math.round(size * 10) / 10}
          onChange={(v) => size > 0 && upd((e) => resizePasses(e, v / size))}
        />
        <p className="mt-1 text-[11px] text-slate-500">{t("editor.brush.passes", { n: passes })}</p>
      </Section>
      <Section title={t("editor.brush.lineStyle")}>
        <LineStylePicker
          value={line}
          color={el.color}
          accent={el.accent ?? DEFAULT_ACCENT}
          onChange={(l) =>
            upd((e) =>
              restyleBrush(
                e,
                l === "solid"
                  ? { line: undefined, spacing: undefined, accent: undefined, flipSide: undefined }
                  : { line: l, rough: undefined, accent: lineTakesAccent(l) ? (e.accent ?? DEFAULT_ACCENT) : undefined, flipSide: l === "cliff" ? e.flipSide : undefined },
              ),
            )
          }
        />
        <LineOptions
          line={line}
          spacing={el.spacing ?? 1}
          accent={el.accent ?? DEFAULT_ACCENT}
          flip={!!el.flipSide}
          onSpacing={(v) => live((e) => ({ ...e, spacing: Math.abs(v - 1) < 0.001 ? undefined : v }))}
          onAccent={(accent) => upd((e) => ({ ...e, accent }))}
          onFlip={(f) => upd((e) => ({ ...e, flipSide: f ? true : undefined }))}
          live={{ start: () => s().beginGesture(), end: () => s().endGesture() }}
        />
      </Section>
      {line === "solid" && (
        <Section title={t("editor.brush.rough")} right={<Pct v={el.rough ?? 0} />}>
          <Slider
            value={el.rough ?? 0}
            onStart={() => s().beginGesture()}
            onEnd={() => s().endGesture()}
            onChange={(v) => live((e) => fitBrushBox({ ...e, rough: v || undefined }))}
          />
        </Section>
      )}
      <Section title={t("editor.brush.paint")}>
        <PaintPicker
          color={el.color}
          texture={lineTakesTexture(line) ? el.texture : null}
          allowTexture={lineTakesTexture(line)}
          idPrefix="bp"
          onColor={(color) => upd((e) => ({ ...e, color }))}
          onTexture={(texture) => upd((e) => ({ ...e, texture, textureSize: texture ? (e.textureSize ?? grid) : undefined }))}
        />
        {el.texture && lineTakesTexture(line) && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{t("editor.brush.textureScale")}</span>
              <span>{Math.round(el.textureSize ?? grid)} px</span>
            </div>
            <Slider
              value={(el.textureSize ?? grid) / grid}
              min={0.25}
              max={6}
              step={0.25}
              onStart={() => s().beginGesture()}
              onEnd={() => s().endGesture()}
              onChange={(v) => live((e) => ({ ...e, textureSize: v * grid }))}
            />
          </div>
        )}
      </Section>
      <Section title={t("editor.brush.softness")} right={<Pct v={el.softness ?? 0} />}>
        <Slider
          value={el.softness ?? 0}
          onStart={() => s().beginGesture()}
          onEnd={() => s().endGesture()}
          onChange={(v) => live((e) => restyleBrush(e, { softness: v || undefined }))}
        />
      </Section>
      {lineTakesEdge(line) && <Section title={t("editor.brush.edge")}>
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={!!el.edge}
            onChange={(ev) =>
              upd((e) =>
                restyleBrush(e, ev.target.checked ? { edge: "#6b5a3e", edgeWidth: e.edgeWidth ?? Math.max(1, grid * 0.08) } : { edge: null, edgeWidth: undefined }),
              )
            }
          />
          {t("editor.brush.edgeOn")}
        </label>
        {el.edge && (
          <div className="flex gap-2">
            <ColorField value={el.edge} onChange={(c) => upd((e) => ({ ...e, edge: c }))} />
            <NumberField className="w-20" suffix="px" min={0.5} max={500} value={el.edgeWidth ?? 4} onChange={(v) => upd((e) => restyleBrush(e, { edgeWidth: v }))} />
          </div>
        )}
      </Section>}
      <div className="mb-4 flex flex-col gap-2">
        {erased > 0 && (
          <Button className="w-full" onClick={() => upd((e) => ({ ...e, ops: e.ops.filter((o) => !o.erase) }))} data-testid="brush-restore">
            <Icon name="undo" size={16} /> {t("editor.brush.restore", { n: erased })}
          </Button>
        )}
        <Button
          className="w-full"
          title={t("editor.brush.pickUpHint")}
          onClick={() => {
            const cur: BrushSettings = useBrush.getState().settings;
            useBrush.getState().set({
              kind: "paint",
              line,
              lineSpacing: el.spacing ?? 1,
              accent: el.accent ?? cur.accent,
              rough: el.rough ?? 0,
              flipSide: !!el.flipSide,
              color: el.color,
              texture: el.texture ?? null,
              textureScale: el.texture ? Math.round(((el.textureSize ?? grid) / grid) * 4) / 4 : useBrush.getState().settings.textureScale,
              softness: el.softness ?? 0,
              edge: !!el.edge,
              edgeColor: el.edge ?? useBrush.getState().settings.edgeColor,
              edgeWidth: el.edge ? Math.round(((el.edgeWidth ?? 0) / grid) * 100) / 100 : useBrush.getState().settings.edgeWidth,
              opacity: el.opacity,
              layer: el.layer,
              size: Math.round((size / grid) * 100) / 100,
            });
            s().setTool("brush");
          }}
        >
          <Icon name="brush" size={16} /> {t("editor.brush.pickUp")}
        </Button>
      </div>
    </div>
  );
}
