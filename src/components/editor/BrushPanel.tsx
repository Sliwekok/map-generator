"use client";

import { useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useAssets } from "@/lib/client/assets";
import { useSession } from "@/lib/client/session";
import { useUploads } from "@/lib/client/uploads";
import { useEditor } from "@/lib/editor/store";
import { useBrush, BRUSH_LIMITS } from "@/lib/editor/brushStore";
import { BRUSH_PRESETS, brushPx, mainSize, presetSettings, resizePasses, restyleBrush, type BrushPreset } from "@/lib/editor/brush";
import { LAYER_ORDER, type BrushElement, type LayerId, type MapElement, type PatternDef } from "@/lib/types";
import FileBrowser from "@/components/files/FileBrowser";
import { Icon } from "@/components/ui/Icon";
import { Button, ColorField, cx, Label, NumberField, Segmented, Slider } from "@/components/ui/controls";
import { LibraryStatus, PatternSwatch, TextureGrid } from "./libraryParts";

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
        <p className="mb-4 text-xs leading-relaxed text-slate-400">{t("editor.brush.eraserHint")}</p>
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
      <Presets />
      <Section title={t("editor.brush.paint")}>
        <PaintPicker
          color={b.color}
          texture={b.texture}
          onColor={(color) => set({ color })}
          onTexture={(texture) => set({ texture })}
          idPrefix="bt"
        />
        {b.texture && (
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
    </div>
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

function LayerSelect({ value, onChange }: { value: LayerId; onChange: (l: LayerId) => void }) {
  const { t } = useI18n();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as LayerId)}
      className="w-full rounded-md bg-slate-800 px-2 py-1.5 text-sm text-slate-100 ring-1 ring-slate-700"
      data-testid="brush-layer"
    >
      {LAYER_ORDER.map((l) => (
        <option key={l} value={l}>
          {t(`editor.layers.${l}` as TKey)}
        </option>
      ))}
    </select>
  );
}

function Presets() {
  const { t } = useI18n();
  const active = useBrush((s) => s.preset);
  const patterns = useAssets((s) => s.patternsById);
  const canUse = useCanUse();
  const apply = (p: BrushPreset) => useBrush.getState().set(presetSettings(p, canUse), p.id);
  return (
    <Section title={t("editor.brush.presets")}>
      <div className="grid grid-cols-3 gap-1.5">
        {BRUSH_PRESETS.map((p) => {
          const tex = p.textures.find(canUse);
          const wantsLocked = p.textures.length > 0 && !tex;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p)}
              data-preset={p.id}
              aria-pressed={active === p.id}
              title={wantsLocked ? t("editor.brush.presetLocked") : t(`editor.brush.presetNames.${p.id}` as TKey)}
              className={cx(
                "relative flex flex-col items-center gap-0.5 rounded-lg bg-slate-800 p-1 ring-2",
                active === p.id ? "ring-amber-500" : "ring-transparent hover:ring-slate-600",
              )}
            >
              <MiniStroke color={p.settings.color!} edge={p.settings.edge ? p.settings.edgeColor! : null} pattern={tex ? patterns[tex] : undefined} id={p.id} />
              <span className="w-full truncate text-center text-[10px] text-slate-300">{t(`editor.brush.presetNames.${p.id}` as TKey)}</span>
              {wantsLocked && <Icon name="lock" size={10} className="absolute right-1 top-1 text-amber-400" />}
            </button>
          );
        })}
      </div>
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
}: {
  color: string;
  texture: string | null | undefined;
  onColor: (c: string) => void;
  onTexture: (t: string | null) => void;
  idPrefix: string;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const status = useAssets((s) => s.status);
  const [mode, setMode] = useState<"color" | "texture">(texture ? "texture" : "color");
  const [filesOpen, setFilesOpen] = useState(false);
  const shown = texture ? "texture" : mode;

  return (
    <div className="space-y-2" data-testid={`${idPrefix}-paint`}>
      <Segmented
        value={shown}
        onChange={(m) => {
          setMode(m);
          if (m === "color") onTexture(null);
        }}
        options={[
          { value: "color", label: t("editor.brush.color") },
          { value: "texture", label: t("editor.brush.texture") },
        ]}
      />
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
      <Section title={t("editor.brush.paint")}>
        <PaintPicker
          color={el.color}
          texture={el.texture}
          idPrefix="bp"
          onColor={(color) => upd((e) => ({ ...e, color }))}
          onTexture={(texture) => upd((e) => ({ ...e, texture, textureSize: texture ? (e.textureSize ?? grid) : undefined }))}
        />
        {el.texture && (
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
      <Section title={t("editor.brush.edge")}>
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
      </Section>
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
            useBrush.getState().set({
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
