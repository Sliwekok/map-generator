"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useEditor } from "@/lib/editor/store";
import { useAssets } from "@/lib/client/assets";
import { useUploads } from "@/lib/client/uploads";
import { toast } from "@/lib/client/toasts";
import {
  buildProject,
  buildSvg,
  downloadBlob,
  MAX_CANVAS_AREA,
  MAX_CANVAS_SIDE,
  rasterize,
  type RasterType,
  UnsupportedFormatError,
  safeFileName,
} from "@/lib/editor/export";
import { Button, cx, Label, Modal, Segmented } from "@/components/ui/controls";

type Format = "png" | "jpg" | "webp" | "json";

const MIME: Record<Exclude<Format, "json">, RasterType> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export default function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const doc = useEditor((s) => s.doc);
  const [format, setFormat] = useState<Format>("png");
  const [scale, setScale] = useState(1);
  const [grid, setGrid] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const w = Math.round(doc.width * scale);
  const h = Math.round(doc.height * scale);
  const raster = format !== "json";
  const tooBig = raster && (w > MAX_CANVAS_SIDE || h > MAX_CANVAS_SIDE || w * h > MAX_CANVAS_AREA);

  const run = async () => {
    setBusy(true);
    const name = safeFileName(doc.name);
    try {
      const { byId, patternsById } = useAssets.getState();
      if (format === "json") {
        const names = Object.fromEntries(Object.values(useUploads.getState().byId).map((u) => [u.id, u.name]));
        const project = await buildProject(doc, names);
        downloadBlob(new Blob([JSON.stringify(project)], { type: "application/json" }), `${name}.mapforge.json`);
      } else {
        const svg = await buildSvg(doc, { assets: byId, patterns: patternsById }, grid && doc.grid.enabled);
        const blob = await rasterize(svg, doc.width, doc.height, scale, MIME[format]);
        downloadBlob(blob, `${name}${scale !== 1 ? `@${scale}x` : ""}.${format}`);
      }
      onClose();
    } catch (e) {
      console.error(e);
      toast(t(e instanceof UnsupportedFormatError ? "editor.exportDlg.unsupported" : "common.errorGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("editor.exportDlg.title")}>
      <div className="space-y-5">
        <div>
          <Label>{t("editor.exportDlg.format")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["png", "jpg", "webp", "json"] as Format[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cx(
                  "rounded-lg px-3 py-2 text-left text-sm ring-1",
                  format === f ? "bg-amber-500/15 text-amber-200 ring-amber-500" : "bg-slate-900 text-slate-300 ring-slate-700 hover:ring-slate-500",
                )}
              >
                {t(`editor.exportDlg.${f}`)}
              </button>
            ))}
          </div>
        </div>
        {raster && (
          <div>
            <Label>{t("editor.exportDlg.scale")}</Label>
            <Segmented
              value={String(scale)}
              onChange={(v) => setScale(Number(v))}
              options={["0.5", "1", "2", "3", "4"].map((v) => ({ value: v, label: `${v}×` }))}
            />
            <p className={cx("mt-2 text-sm", tooBig ? "text-red-400" : "text-slate-400")}>
              {tooBig ? t("editor.exportDlg.tooBig", { max: MAX_CANVAS_SIDE }) : t("editor.exportDlg.result", { w, h })}
            </p>
          </div>
        )}
        {format !== "json" && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} disabled={!doc.grid.enabled} />
            {t("editor.exportDlg.includeGrid")}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={run} disabled={busy || tooBig}>
            {busy ? t("editor.exportDlg.working") : t("editor.exportDlg.download")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
