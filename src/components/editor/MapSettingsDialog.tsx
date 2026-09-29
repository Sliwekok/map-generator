"use client";

import { useState } from "react";
import type { MapContent } from "@/lib/types";
import { useI18n, type TKey } from "@/lib/i18n";
import { useEditor } from "@/lib/editor/store";
import { GRID_PRESETS, LIMITS, PAGE_PRESETS } from "@/lib/limits";
import { Button, ColorField, cx, Label, Modal, NumberField, Segmented } from "@/components/ui/controls";

export default function MapSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  // Mounting the form only while open means it always starts from the current map values.
  if (!open || !doc) return null;
  return <SettingsForm doc={doc} onClose={onClose} />;
}

function SettingsForm({ doc, onClose }: { doc: MapContent; onClose: () => void }) {
  const { t } = useI18n();
  const [w, setW] = useState(doc.width);
  const [h, setH] = useState(doc.height);
  const [keep, setKeep] = useState(true);
  const [mode, setMode] = useState<"canvas" | "scale">("scale");
  const [anchor, setAnchor] = useState<[number, number]>([0.5, 0.5]);
  const [grid, setGrid] = useState(doc.grid);

  const ratio = doc.width / doc.height;
  const clamp = (n: number) => Math.round(Math.min(LIMITS.map.maxSize, Math.max(LIMITS.map.minSize, n)));

  const setWidth = (v: number) => {
    setW(clamp(v));
    if (keep) setH(clamp(v / ratio));
  };
  const setHeight = (v: number) => {
    setH(clamp(v));
    if (keep) setW(clamp(v * ratio));
  };
  const quick = (k: number) => {
    setW(clamp(doc.width * k));
    setH(clamp(doc.height * k));
  };

  const scaledGrid = mode === "scale" ? grid.size * Math.sqrt((w / doc.width) * (h / doc.height)) : grid.size;

  const apply = () => {
    const s = useEditor.getState();
    s.beginGesture();
    if (w !== doc.width || h !== doc.height) s.resizePage(w, h, mode, anchor);
    const cur = useEditor.getState().doc!;
    // If the user typed a new grid size, it wins; otherwise keep the (possibly scaled) size.
    const nextGrid = { ...grid, size: grid.size !== doc.grid.size ? grid.size : cur.grid.size };
    s.setDoc((d) => ({ ...d, grid: nextGrid }));
    s.endGesture();
    s.setShowGrid(nextGrid.enabled);
    window.dispatchEvent(new Event("mapforge:fit"));
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={t("editor.mapSettings.title")} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Label>{t("editor.mapSettings.page")}</Label>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <NumberField label={t("wizard.width")} suffix="px" value={w} onChange={setWidth} />
            <NumberField label={t("wizard.height")} suffix="px" value={h} onChange={setHeight} />
          </div>
          <label className="mb-3 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            {t("editor.mapSettings.keepRatio")}
          </label>
          <div className="mb-3 flex flex-wrap gap-1">
            <span className="mr-1 self-center text-xs text-slate-400">{t("editor.mapSettings.quick")}:</span>
            <Button className="px-2 py-1 text-xs" onClick={() => quick(0.5)}>
              {t("editor.mapSettings.half")}
            </Button>
            <Button className="px-2 py-1 text-xs" onClick={() => quick(2)}>
              {t("editor.mapSettings.double")}
            </Button>
            {PAGE_PRESETS.map((p) => (
              <Button
                key={p.key}
                className="px-2 py-1 text-xs"
                onClick={() => {
                  setKeep(false);
                  setW(p.w);
                  setH(p.h);
                }}
              >
                {t(`wizard.preset_${p.key}` as TKey)}
              </Button>
            ))}
          </div>
          <Label>{t("editor.mapSettings.mode")}</Label>
          <div className="space-y-1.5 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "scale"} onChange={() => setMode("scale")} />
              {t("editor.mapSettings.modeScale")}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "canvas"} onChange={() => setMode("canvas")} />
              {t("editor.mapSettings.modeCanvas")}
            </label>
          </div>
          {mode === "canvas" && (
            <div className="mt-3">
              <Label>{t("editor.mapSettings.anchor")}</Label>
              <div className="grid w-24 grid-cols-3 gap-1">
                {[0, 0.5, 1].flatMap((ay) =>
                  [0, 0.5, 1].map((ax) => (
                    <button
                      key={`${ax}-${ay}`}
                      onClick={() => setAnchor([ax, ay])}
                      className={cx("h-7 rounded", anchor[0] === ax && anchor[1] === ay ? "bg-amber-500" : "bg-slate-700 hover:bg-slate-600")}
                      aria-label={`anchor ${ax} ${ay}`}
                    />
                  )),
                )}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            {doc.width} × {doc.height} → <b className="text-slate-200">{w} × {h}</b> px
            {grid.enabled && <> · {t("editor.mapSettings.info", { cols: +(w / scaledGrid).toFixed(1), rows: +(h / scaledGrid).toFixed(1) })}</>}
          </p>
        </div>

        <div>
          <Label>{t("editor.mapSettings.grid")}</Label>
          <label className="mb-3 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={grid.enabled} onChange={(e) => setGrid({ ...grid, enabled: e.target.checked })} />
            {t("editor.mapSettings.gridEnabled")}
          </label>
          <div className={cx("space-y-3", !grid.enabled && "pointer-events-none opacity-40")}>
            <NumberField label={t("wizard.gridSize")} suffix="px" min={8} max={1000} value={grid.size} onChange={(v) => setGrid({ ...grid, size: v })} />
            <div className="flex flex-wrap gap-1">
              {GRID_PRESETS.map((g) => (
                <Button key={g.size} className={cx("px-2 py-1 text-xs", grid.size === g.size && "ring-2 ring-amber-500")} onClick={() => setGrid({ ...grid, size: g.size })}>
                  {g.label}
                </Button>
              ))}
            </div>
            <Segmented
              value={grid.style}
              onChange={(v) => setGrid({ ...grid, style: v })}
              options={[
                { value: "lines", label: t("wizard.styleLines") },
                { value: "dots", label: t("wizard.styleDots") },
              ]}
            />
            <div className="flex items-center gap-3">
              <ColorField value={grid.color} onChange={(c) => setGrid({ ...grid, color: c })} />
              <NumberField className="w-28" label="α" min={0} max={1} step={0.05} value={grid.opacity} onChange={(v) => setGrid({ ...grid, opacity: v })} />
            </div>
            <NumberField label={t("editor.mapSettings.gridLineWidth")} min={0.25} max={20} step={0.25} value={grid.lineWidth} onChange={(v) => setGrid({ ...grid, lineWidth: v })} />
            {mode === "scale" && (w !== doc.width || h !== doc.height) && (
              <p className="text-xs text-amber-300/80">
                {t("wizard.gridSize")}: {grid.size} → {Math.round(scaledGrid * 100) / 100} px
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={apply}>
          {t("editor.mapSettings.apply")}
        </Button>
      </div>
    </Modal>
  );
}
