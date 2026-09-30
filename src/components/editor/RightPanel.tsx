"use client";

import { useMemo, useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useEditor } from "@/lib/editor/store";
import { useAssets } from "@/lib/client/assets";
import { useUploads } from "@/lib/client/uploads";
import { aabb, scaleBrushContent, unionBox } from "@/lib/editor/geometry";
import { snapBox } from "@/lib/editor/factory";
import { relayoutText } from "@/lib/editor/text";
import { LAYER_ORDER, type LayerId, type MapElement, type TextElement } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Button, ColorField, cx, IconButton, Label, NumberField, Segmented, Slider } from "@/components/ui/controls";
import { BrushProps, BrushToolPanel } from "./BrushPanel";

export default function RightPanel() {
  const { t } = useI18n();
  const painting = useEditor((s) => s.tool === "brush" || s.tool === "eraser");
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-slate-700 bg-slate-900">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {painting ? (
          <BrushToolPanel />
        ) : (
          <>
            <h3 className="mb-3 text-sm font-semibold text-slate-200">{t("editor.panels.properties")}</h3>
            <Properties />
          </>
        )}
      </div>
      <div className="border-t border-slate-700 p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Icon name="layers" size={16} /> {t("editor.panels.layers")}
        </h3>
        <Layers />
        <ItemList />
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <Label>{title}</Label>
      {children}
    </div>
  );
}

function Properties() {
  const { t } = useI18n();
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const s = useEditor.getState;

  const els = useMemo(() => {
    if (!doc) return [];
    const ids = new Set(selection);
    return doc.elements.filter((e) => ids.has(e.id));
  }, [doc, selection]);

  if (!doc) return null;
  if (!els.length) return <MapProps />;

  const single = els.length === 1 ? els[0] : null;
  const box = unionBox(els.map(aabb))!;
  const allLocked = els.every((e) => e.locked);
  const ids = els.map((e) => e.id);
  const upd = (fn: (e: MapElement) => MapElement) => s().updateElements(ids, fn);
  const updLive = (fn: (e: MapElement) => MapElement) => s().updateElements(ids, fn, { history: false });

  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">{t("editor.props.selected", { n: els.length })}</p>

      {single ? (
        <>
          <Section title={t("editor.props.position")}>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="X" value={single.x} onChange={(v) => upd((e) => ({ ...e, x: v }))} />
              <NumberField label="Y" value={single.y} onChange={(v) => upd((e) => ({ ...e, y: v }))} />
            </div>
          </Section>
          <Section title={t("editor.props.size")}>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="W"
                min={2}
                value={single.width}
                onChange={(v) => upd((e) => resizeTo(e, v, null))}
              />
              <NumberField label="H" min={2} value={single.height} onChange={(v) => upd((e) => resizeTo(e, null, v))} />
            </div>
          </Section>
          <Section title={t("editor.props.rotation")}>
            <div className="flex gap-2">
              <NumberField className="flex-1" suffix="°" value={single.rotation} min={-360} max={360} onChange={(v) => upd((e) => ({ ...e, rotation: v }))} />
              <IconButton icon="rotL" title="-90°" onClick={() => s().rotateSelection(-90)} />
              <IconButton icon="rotR" title="+90°" onClick={() => s().rotateSelection(90)} />
            </div>
          </Section>
        </>
      ) : (
        <Section title={`${t("editor.props.size")} (${Math.round(box.width)} × ${Math.round(box.height)})`}>
          <div className="flex gap-2">
            <IconButton icon="rotL" title={`${t("editor.props.rotate")} -90°`} onClick={() => s().rotateSelection(-90)} />
            <IconButton icon="rotR" title={`${t("editor.props.rotate")} +90°`} onClick={() => s().rotateSelection(90)} />
          </div>
        </Section>
      )}

      <ScaleControls />

      <Section title={t("editor.props.opacity")}>
        <Slider
          value={single ? single.opacity : els[0].opacity}
          onStart={() => s().beginGesture()}
          onEnd={() => s().endGesture()}
          onChange={(v) => updLive((e) => ({ ...e, opacity: v }))}
        />
      </Section>

      <Section title={t("editor.props.layer")}>
        <select
          value={els.every((e) => e.layer === els[0].layer) ? els[0].layer : ""}
          onChange={(e) => upd((el) => ({ ...el, layer: e.target.value as LayerId }))}
          className="w-full rounded-md bg-slate-800 px-2 py-1.5 text-sm text-slate-100 ring-1 ring-slate-700"
        >
          <option value="" disabled>
            —
          </option>
          {LAYER_ORDER.map((l) => (
            <option key={l} value={l}>
              {t(`editor.layers.${l}` as TKey)}
            </option>
          ))}
        </select>
      </Section>

      {single && <TypeProps el={single} />}

      <Section title={t("editor.props.arrange")}>
        <div className="flex flex-wrap gap-1">
          <IconButton icon="front" title={t("editor.props.toFront")} onClick={() => s().reorder("front")} />
          <IconButton icon="up" title={t("editor.props.forward")} onClick={() => s().reorder("forward")} />
          <IconButton icon="down" title={t("editor.props.backward")} onClick={() => s().reorder("backward")} />
          <IconButton icon="back" title={t("editor.props.toBack")} onClick={() => s().reorder("back")} />
          <IconButton icon="flipH" title={t("editor.props.flipH")} onClick={() => upd((e) => ({ ...e, flipX: !e.flipX || undefined }))} />
          <IconButton icon="flipV" title={t("editor.props.flipV")} onClick={() => upd((e) => ({ ...e, flipY: !e.flipY || undefined }))} />
          <IconButton
            icon={allLocked ? "unlock" : "lock"}
            title={allLocked ? t("editor.props.unlock") : t("editor.props.lock")}
            active={allLocked}
            onClick={() => upd((e) => ({ ...e, locked: allLocked ? undefined : true }))}
          />
          <IconButton
            icon="grid"
            title={t("editor.props.snapToGrid")}
            onClick={() =>
              upd((e) => {
                const b = aabb(e);
                const p = snapBox(b, doc.grid.size);
                return { ...e, x: e.x + (p.x - b.x), y: e.y + (p.y - b.y) };
              })
            }
          />
        </div>
      </Section>

      {els.length > 1 && (
        <Section title={t("editor.props.align")}>
          <div className="flex flex-wrap gap-1">
            <IconButton icon="alignL" title={t("editor.props.alignLeft")} onClick={() => s().align("left")} />
            <IconButton icon="alignCH" title={t("editor.props.alignCenterH")} onClick={() => s().align("centerH")} />
            <IconButton icon="alignR" title={t("editor.props.alignRight")} onClick={() => s().align("right")} />
            <IconButton icon="alignT" title={t("editor.props.alignTop")} onClick={() => s().align("top")} />
            <IconButton icon="alignM" title={t("editor.props.alignMiddle")} onClick={() => s().align("middle")} />
            <IconButton icon="alignB" title={t("editor.props.alignBottom")} onClick={() => s().align("bottom")} />
            {els.length > 2 && (
              <>
                <IconButton icon="distH" title={t("editor.props.distributeH")} onClick={() => s().align("distH")} />
                <IconButton icon="distV" title={t("editor.props.distributeV")} onClick={() => s().align("distV")} />
              </>
            )}
          </div>
        </Section>
      )}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => s().duplicateSelection()}>
          <Icon name="copy" size={16} /> {t("common.duplicate")}
        </Button>
        <Button variant="danger" className="flex-1" onClick={() => s().deleteSelection()}>
          <Icon name="trash" size={16} /> {t("common.delete")}
        </Button>
      </div>
    </div>
  );
}

function resizeTo(e: MapElement, w: number | null, h: number | null): MapElement {
  const width = w ?? e.width;
  const height = h ?? e.height;
  if (e.type === "text") {
    const k = w !== null ? width / e.width : height / e.height;
    return relayoutText({ ...e, fontSize: Math.max(4, e.fontSize * k) });
  }
  if (e.type === "brush") return scaleBrushContent(e, width / e.width, height / e.height);
  const next = { ...e, width, height } as MapElement;
  if (next.type === "path" && e.type === "path") {
    next.points = e.points.map(([x, y]) => [(x * width) / e.width, (y * height) / e.height]);
  }
  return next;
}

function ScaleControls() {
  const { t } = useI18n();
  const [pct, setPct] = useState(150);
  const scale = (f: number) => useEditor.getState().scaleSelection(f);
  return (
    <Section title={t("editor.props.scale")}>
      <div className="mb-2 grid grid-cols-4 gap-1">
        {[0.5, 0.9, 1.1, 2].map((f) => (
          <Button key={f} className="px-1 py-1 text-xs" onClick={() => scale(f)}>
            {Math.round(f * 100)}%
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <NumberField className="flex-1" value={pct} min={1} max={2000} suffix="%" onChange={setPct} />
        <Button className="py-1 text-xs" onClick={() => scale(pct / 100)}>
          {t("editor.props.apply")}
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">[ / ] = −10% / +10%</p>
    </Section>
  );
}

function TypeProps({ el }: { el: MapElement }) {
  const { t } = useI18n();
  const assets = useAssets((s) => s.byId);
  const s = useEditor.getState;
  const upd = (fn: (e: MapElement) => MapElement) => s().updateElements([el.id], fn);

  if (el.type === "asset") {
    const def = assets[el.assetId];
    if (!def?.tintable) return null;
    return (
      <Section title={t("editor.props.tint")}>
        <div className="flex items-center gap-2">
          <ColorField value={el.tint ?? def.defaultTint ?? "#444444"} onChange={(c) => upd((e) => ({ ...e, tint: c }))} />
          <Button className="px-2 py-1 text-xs" onClick={() => upd((e) => ({ ...e, tint: undefined }))}>
            {t("editor.props.resetTint")}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {["#2f6fd6", "#c0392b", "#27ae60", "#8e44ad", "#f1c40f", "#e67e22", "#7f8c8d", "#111111"].map((c) => (
            <button key={c} onClick={() => upd((e) => ({ ...e, tint: c }))} className="h-6 w-6 rounded-full ring-1 ring-slate-600" style={{ background: c }} />
          ))}
        </div>
      </Section>
    );
  }
  if (el.type === "rect" || el.type === "ellipse") {
    return (
      <>
        <Section title={t("editor.props.fill")}>
          <ColorField value={el.fill} onChange={(c) => upd((e) => ({ ...e, fill: c }))} />
          <div className="mt-2 text-xs text-slate-400">{t("editor.props.fillOpacity")}</div>
          <Slider value={el.fillOpacity} onStart={() => s().beginGesture()} onEnd={() => s().endGesture()} onChange={(v) => s().updateElements([el.id], (e) => ({ ...e, fillOpacity: v }), { history: false })} />
        </Section>
        <Section title={t("editor.props.stroke")}>
          <div className="flex gap-2">
            <ColorField value={el.stroke} onChange={(c) => upd((e) => ({ ...e, stroke: c }))} />
            <NumberField className="w-20" min={0} max={200} value={el.strokeWidth} onChange={(v) => upd((e) => ({ ...e, strokeWidth: v }))} />
          </div>
        </Section>
        {el.type === "rect" && (
          <Section title={t("editor.props.radius")}>
            <NumberField min={0} value={el.radius ?? 0} onChange={(v) => upd((e) => ({ ...e, radius: v }))} />
          </Section>
        )}
      </>
    );
  }
  if (el.type === "brush") return <BrushProps el={el} />;
  if (el.type === "path") {
    return (
      <Section title={t("editor.props.stroke")}>
        <div className="flex gap-2">
          <ColorField value={el.stroke} onChange={(c) => upd((e) => ({ ...e, stroke: c }))} />
          <NumberField className="w-20" min={0.5} max={500} value={el.strokeWidth} onChange={(v) => upd((e) => ({ ...e, strokeWidth: v }))} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={!!el.closed} onChange={(e) => upd((x) => (x.type === "path" ? { ...x, closed: e.target.checked || undefined, fill: e.target.checked ? (x.fill ?? "#4d8fc4") : null } : x))} />
          {t("editor.props.closedPath")}
        </label>
        {el.closed && (
          <div className="mt-2">
            <ColorField value={el.fill ?? "#4d8fc4"} onChange={(c) => upd((e) => ({ ...e, fill: c }))} />
          </div>
        )}
      </Section>
    );
  }
  // text
  const tx = el as TextElement;
  const updText = (patch: Partial<TextElement>) => upd((e) => relayoutText({ ...(e as TextElement), ...patch }));
  return (
    <>
      <Section title={t("editor.props.text")}>
        <textarea
          value={tx.text}
          onFocus={() => s().beginGesture()}
          onBlur={() => s().endGesture()}
          onChange={(e) => s().updateElements([el.id], (x) => relayoutText({ ...(x as TextElement), text: e.target.value }), { history: false })}
          rows={2}
          className="w-full rounded-md bg-slate-800 px-2 py-1.5 text-sm text-slate-100 ring-1 ring-slate-700 outline-none focus:ring-amber-500"
        />
        <p className="text-[11px] text-slate-500">{t("editor.textEdit")}</p>
      </Section>
      <Section title={t("editor.props.font")}>
        <select
          value={tx.fontFamily}
          onChange={(e) => updText({ fontFamily: e.target.value as TextElement["fontFamily"] })}
          className="mb-2 w-full rounded-md bg-slate-800 px-2 py-1.5 text-sm text-slate-100 ring-1 ring-slate-700"
        >
          {(["serif", "sans", "mono", "fantasy"] as const).map((f) => (
            <option key={f} value={f}>
              {t(`editor.props.fonts.${f}` as TKey)}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <NumberField className="flex-1" label="px" min={4} max={2000} value={tx.fontSize} onChange={(v) => updText({ fontSize: v })} />
          <IconButton icon="text" title={t("editor.props.bold")} active={!!tx.bold} onClick={() => updText({ bold: !tx.bold || undefined })} />
          <button
            title={t("editor.props.italic")}
            onClick={() => updText({ italic: !tx.italic || undefined })}
            className={cx("h-9 w-9 rounded-lg font-serif italic", tx.italic ? "bg-amber-500 text-slate-950" : "text-slate-200 hover:bg-slate-700")}
          >
            I
          </button>
        </div>
      </Section>
      <Section title={t("editor.props.tint")}>
        <ColorField value={tx.color} onChange={(c) => upd((e) => ({ ...e, color: c }))} />
      </Section>
      <Section title={t("editor.props.outline")}>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={!!tx.outline} onChange={(e) => upd((x) => ({ ...x, outline: e.target.checked ? "#ffffff" : null }))} />
          {tx.outline && <ColorField value={tx.outline} onChange={(c) => upd((e) => ({ ...e, outline: c }))} />}
        </div>
      </Section>
    </>
  );
}

function MapProps() {
  const { t } = useI18n();
  const doc = useEditor((s) => s.doc)!;
  const setDoc = useEditor((s) => s.setDoc);
  const hasLocked = doc.elements.some((e) => e.locked);
  const g = doc.grid;
  const setGrid = (patch: Partial<typeof g>, history = true) => setDoc((d) => ({ ...d, grid: { ...d.grid, ...patch } }), { history });
  return (
    <div>
      <p className="mb-4 text-xs leading-relaxed text-slate-400">{t("editor.props.nothing")}</p>
      <Section title={t("editor.panels.map")}>
        <div className="rounded-lg bg-slate-800 p-3 text-sm text-slate-300">
          <div>
            {doc.width} × {doc.height} px
          </div>
          {g.enabled && (
            <div className="text-slate-400">
              {t("editor.mapSettings.info", {
                cols: Math.round((doc.width / g.size) * 10) / 10,
                rows: Math.round((doc.height / g.size) * 10) / 10,
              })}{" "}
              · {g.size} px
            </div>
          )}
          <div className="text-slate-400">
            {t("editor.statusBar.elements")}: {doc.elements.length}
          </div>
        </div>
      </Section>
      <Section title={t("editor.mapSettings.grid")}>
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={g.enabled} onChange={(e) => setGrid({ enabled: e.target.checked })} />
          {t("editor.mapSettings.gridEnabled")}
        </label>
        {g.enabled && (
          <div className="space-y-2">
            <NumberField label={t("wizard.gridSize")} suffix="px" min={8} max={1000} value={g.size} onChange={(v) => setGrid({ size: v })} />
            <Segmented
              value={g.style}
              onChange={(v) => setGrid({ style: v })}
              options={[
                { value: "lines", label: t("wizard.styleLines") },
                { value: "dots", label: t("wizard.styleDots") },
              ]}
            />
            <div className="flex items-center gap-2">
              <ColorField value={g.color} onChange={(c) => setGrid({ color: c })} />
            </div>
            <div className="text-xs text-slate-400">{t("editor.mapSettings.gridOpacity")}</div>
            <Slider
              value={g.opacity}
              onStart={() => useEditor.getState().beginGesture()}
              onEnd={() => useEditor.getState().endGesture()}
              onChange={(v) => setGrid({ opacity: v }, false)}
            />
            <NumberField label={t("editor.mapSettings.gridLineWidth")} min={0.25} max={20} step={0.25} value={g.lineWidth} onChange={(v) => setGrid({ lineWidth: v })} />
          </div>
        )}
      </Section>
      {hasLocked && (
        <Button className="w-full" onClick={() => setDoc((d) => ({ ...d, elements: d.elements.map((e) => (e.locked ? { ...e, locked: undefined } : e)) }))}>
          <Icon name="unlock" size={16} /> {t("editor.props.unlock")} ({doc.elements.filter((e) => e.locked).length})
        </Button>
      )}
    </div>
  );
}

function Layers() {
  const { t } = useI18n();
  const doc = useEditor((s) => s.doc);
  if (!doc) return null;
  const s = useEditor.getState;
  return (
    <ul className="space-y-1">
      {[...LAYER_ORDER].reverse().map((id) => {
        const l = doc.layers.find((x) => x.id === id)!;
        const count = doc.elements.filter((e) => e.layer === id).length;
        return (
          <li key={id} className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1">
            <button
              className={cx("flex-1 truncate text-left text-sm", l.visible ? "text-slate-200" : "text-slate-500 line-through")}
              title={t("editor.layers.selectAll")}
              onClick={() => s().select(doc.elements.filter((e) => e.layer === id).map((e) => e.id))}
            >
              {t(`editor.layers.${id}` as TKey)} <span className="text-xs text-slate-500">({count})</span>
            </button>
            <IconButton
              className="h-7 w-7"
              size={15}
              icon={l.visible ? "eye" : "eyeOff"}
              title={l.visible ? t("editor.layers.hide") : t("editor.layers.show")}
              onClick={() => s().setLayerFlag(id, "visible", !l.visible)}
            />
            <IconButton
              className="h-7 w-7"
              size={15}
              icon={l.locked ? "lock" : "unlock"}
              active={l.locked}
              title={l.locked ? t("editor.layers.unlock") : t("editor.layers.lock")}
              onClick={() => s().setLayerFlag(id, "locked", !l.locked)}
            />
          </li>
        );
      })}
    </ul>
  );
}

const TYPE_ICON: Record<string, string> = { asset: "image", image: "image", rect: "rect", ellipse: "ellipse", path: "pen", brush: "brush", text: "text" };

/** Collapsible list of every element on the map: click selects (and centers), trash deletes. */
function ItemList() {
  const { t, lang } = useI18n();
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const assets = useAssets((s) => s.byId);
  const uploads = useUploads((s) => s.byId);
  const [open, setOpen] = useState(false);
  if (!doc) return null;
  const s = useEditor.getState;
  const sel = new Set(selection);

  const labelOf = (e: MapElement): { kind: string; name: string } => {
    if (e.type === "asset") {
      if (e.assetId.startsWith("u:")) return { kind: "image", name: uploads[e.assetId.slice(2)]?.name ?? t("editor.layers.types.image") };
      return { kind: "asset", name: assets[e.assetId]?.name[lang] ?? t("editor.layers.types.asset") };
    }
    if (e.type === "text") return { kind: "text", name: e.text.replace(/\s+/g, " ").trim() || t("editor.layers.types.text") };
    return { kind: e.type, name: t(`editor.layers.types.${e.type}` as TKey) };
  };

  const onPick = (ev: React.MouseEvent, id: string) => {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      s().toggleSelect(id);
      return;
    }
    s().select([id]);
    window.dispatchEvent(new CustomEvent("mapforge:focus", { detail: { id } }));
  };

  // Top layer first; inside a layer, top-most (last drawn) element first.
  const groups = [...LAYER_ORDER].reverse().map((layerId) => ({
    layer: doc.layers.find((l) => l.id === layerId)!,
    items: doc.elements.filter((e) => e.layer === layerId).reverse(),
  }));

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md bg-slate-800 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
      >
        <Icon name="list" size={15} />
        <span className="flex-1 text-left">
          {t("editor.layers.items")} <span className="text-xs text-slate-500">({doc.elements.length})</span>
        </span>
        <Icon name="chevronDown" size={15} className={cx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1 max-h-64 overflow-y-auto rounded-md bg-slate-950/40 p-1 ring-1 ring-slate-800">
          {!doc.elements.length && <p className="px-2 py-3 text-center text-xs text-slate-500">{t("editor.layers.noItems")}</p>}
          {groups.map(({ layer, items }) =>
            items.length ? (
              <div key={layer.id} className="mb-1">
                <div className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {t(`editor.layers.${layer.id}` as TKey)}
                </div>
                <ul>
                  {items.map((e) => {
                    const { kind, name } = labelOf(e);
                    const locked = !!e.locked || layer.locked;
                    const hidden = !layer.visible;
                    const active = sel.has(e.id);
                    return (
                      <li
                        key={e.id}
                        className={cx("group flex items-center gap-1 rounded px-1", active ? "bg-amber-500/20 ring-1 ring-amber-500/60" : "hover:bg-slate-800")}
                      >
                        <button
                          disabled={hidden}
                          title={hidden ? t("editor.layers.hiddenLayer") : t("editor.layers.selectItem")}
                          onClick={(ev) => onPick(ev, e.id)}
                          className={cx(
                            "flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-xs",
                            hidden ? "cursor-not-allowed text-slate-600" : active ? "text-amber-200" : "text-slate-300",
                          )}
                        >
                          <Icon name={TYPE_ICON[kind]} size={14} className="shrink-0 text-slate-500" />
                          <span className="truncate">{name}</span>
                          {e.locked && <Icon name="lock" size={12} className="shrink-0 text-slate-500" />}
                        </button>
                        <button
                          disabled={locked}
                          title={locked ? t("editor.layers.lockedItem") : t("editor.layers.deleteItem")}
                          onClick={() => s().deleteElements([e.id])}
                          className={cx(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                            locked ? "cursor-not-allowed text-slate-700" : "text-slate-500 hover:bg-red-500/20 hover:text-red-400",
                          )}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
