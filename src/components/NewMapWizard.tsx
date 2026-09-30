"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useSession } from "@/lib/client/session";
import { createMap, LimitError } from "@/lib/client/repo";
import { toast } from "@/lib/client/toasts";
import { createMapContent } from "@/lib/mapContent";
import { DEFAULT_GRID_SIZE, GRID_PRESETS, LIMITS, maxCells, PAGE_PRESETS, pageFromCells } from "@/lib/limits";
import type { GridStyle } from "@/lib/types";
import { Button, ColorField, cx, Label, Modal, NumberField, Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import MapThumbnail from "@/components/map/MapThumbnail";

const BG_SWATCHES = ["#e8dcc0", "#ffffff", "#7fae4e", "#8f8a80", "#55504a", "#2b2522"];

export default function NewMapWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [sizeMode, setSizeMode] = useState<"px" | "cells">("px");
  const [pxW, setW] = useState(1400);
  const [pxH, setH] = useState(1050);
  const [cols, setCols] = useState(20);
  const [rows, setRows] = useState(15);
  const [useGrid, setUseGrid] = useState(true);
  const [size, setSize] = useState(DEFAULT_GRID_SIZE);
  const [style, setStyle] = useState<GridStyle>("lines");
  const [gridColor, setGridColor] = useState("#000000");
  const [name, setName] = useState("");
  const [bg, setBg] = useState("#e8dcc0");
  const [busy, setBusy] = useState(false);

  const clamp = (n: number) => Math.round(Math.min(LIMITS.map.maxSize, Math.max(LIMITS.map.minSize, n)));

  // In "cells" mode the page size is derived from columns × rows × cell size.
  const fromCells = pageFromCells(cols, rows, size);
  const w = sizeMode === "cells" ? fromCells.w : pxW;
  const h = sizeMode === "cells" ? fromCells.h : pxH;

  const changeSizeMode = (m: "px" | "cells") => {
    if (m === sizeMode) return;
    if (m === "cells") {
      setCols(Math.max(1, Math.round(pxW / size)));
      setRows(Math.max(1, Math.round(pxH / size)));
      setUseGrid(true);
    } else {
      setW(fromCells.w);
      setH(fromCells.h);
    }
    setSizeMode(m);
  };

  const preview = useMemo(
    () =>
      createMapContent({
        name: name || t("wizard.defaultName"),
        width: w,
        height: h,
        grid: { enabled: useGrid, size, style, color: gridColor },
        background: { color: bg },
      }),
    [name, w, h, useGrid, size, style, gridColor, bg, t],
  );

  const close = () => {
    setStep(1);
    setSizeMode("px");
    onClose();
  };

  const create = async () => {
    setBusy(true);
    try {
      const doc = await createMap(user, preview);
      close();
      router.push(`/editor/${doc.id}`);
    } catch (e) {
      if (e instanceof LimitError) toast(t("maps.limitReached", { max: e.limit }), "error");
      else toast(t("common.errorGeneric"), "error");
    } finally {
      setBusy(false);
    }
  };

  const steps: TKey[] = ["wizard.step1", "wizard.step2", "wizard.step3"];

  return (
    <Modal open={open} onClose={close} title={t("wizard.title")} wide>
      <ol className="mb-6 flex gap-2">
        {steps.map((s, i) => (
          <li
            key={s}
            className={cx(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium",
              step === i + 1 ? "bg-amber-500 text-slate-950" : step > i + 1 ? "bg-slate-700 text-slate-200" : "bg-slate-900 text-slate-500",
            )}
          >
            {t(s)}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 md:grid-cols-[1fr_220px]">
        <div>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>{t("wizard.sizeBy")}</Label>
                <Segmented
                  value={sizeMode}
                  onChange={changeSizeMode}
                  options={[
                    { value: "px", label: t("wizard.sizeByPx") },
                    { value: "cells", label: t("wizard.sizeByCells") },
                  ]}
                />
              </div>
              {sizeMode === "cells" ? (
                <>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>{t("wizard.columns")}</Label>
                      <NumberField value={cols} min={1} max={maxCells(size)} onChange={(v) => setCols(Math.round(v))} />
                    </div>
                    <Button
                      variant="ghost"
                      title={t("wizard.swap")}
                      onClick={() => {
                        setCols(rows);
                        setRows(cols);
                      }}
                    >
                      ⇄
                    </Button>
                    <div className="flex-1">
                      <Label>{t("wizard.rows")}</Label>
                      <NumberField value={rows} min={1} max={maxCells(size)} onChange={(v) => setRows(Math.round(v))} />
                    </div>
                  </div>
                  <div>
                    <Label>{t("wizard.gridSize")}</Label>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {GRID_PRESETS.map((g) => (
                        <Button key={g.size} className={cx("px-2 py-1 text-xs", size === g.size && "ring-2 ring-amber-500")} onClick={() => setSize(g.size)}>
                          {g.label}
                        </Button>
                      ))}
                    </div>
                    <NumberField value={size} suffix="px" min={8} max={1000} onChange={setSize} className="w-40" />
                  </div>
                  <p className="text-sm text-amber-200">{t("wizard.cellsResult", { w, h })}</p>
                  {fromCells.clamped && (
                    <p className="text-xs text-red-300">{t("wizard.cellsClamped", { min: LIMITS.map.minSize, max: LIMITS.map.maxSize })}</p>
                  )}
                  <p className="text-xs text-slate-400">{t("wizard.cellsHint")}</p>
                </>
              ) : (
                <>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>{t("wizard.width")}</Label>
                  <NumberField value={w} suffix="px" min={LIMITS.map.minSize} max={LIMITS.map.maxSize} onChange={(v) => setW(clamp(v))} />
                </div>
                <Button
                  variant="ghost"
                  title={t("wizard.swap")}
                  onClick={() => {
                    setW(h);
                    setH(w);
                  }}
                >
                  ⇄
                </Button>
                <div className="flex-1">
                  <Label>{t("wizard.height")}</Label>
                  <NumberField value={h} suffix="px" min={LIMITS.map.minSize} max={LIMITS.map.maxSize} onChange={(v) => setH(clamp(v))} />
                </div>
              </div>
              <div>
                <Label>{t("wizard.presets")}</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PAGE_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => {
                        setW(p.w);
                        setH(p.h);
                      }}
                      className={cx(
                        "rounded-lg px-3 py-2 text-left ring-1",
                        w === p.w && h === p.h ? "bg-amber-500/15 ring-amber-500" : "bg-slate-900 ring-slate-700 hover:ring-slate-500",
                      )}
                    >
                      <div className="text-sm font-medium text-slate-100">{t(`wizard.preset_${p.key}` as TKey)}</div>
                      <div className="text-xs text-slate-400">
                        {p.w} × {p.h}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400">{t("wizard.sizeHint")}</p>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="font-medium">{t("wizard.gridQuestion")}</p>
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setUseGrid(v)}
                    className={cx(
                      "flex items-center gap-2 rounded-lg px-3 py-3 text-sm ring-1",
                      useGrid === v ? "bg-amber-500/15 text-amber-100 ring-amber-500" : "bg-slate-900 text-slate-300 ring-slate-700",
                    )}
                  >
                    <Icon name={v ? "grid" : "x"} /> {v ? t("wizard.gridYes") : t("wizard.gridNo")}
                  </button>
                ))}
              </div>
              {useGrid && (
                <>
                  <div>
                    <Label>{t("wizard.gridSize")}</Label>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {GRID_PRESETS.map((g) => (
                        <Button key={g.size} className={cx("px-2 py-1 text-xs", size === g.size && "ring-2 ring-amber-500")} onClick={() => setSize(g.size)}>
                          {g.label}
                        </Button>
                      ))}
                    </div>
                    <NumberField value={size} suffix="px" min={8} max={1000} onChange={setSize} className="w-40" />
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <Label>{t("wizard.gridStyle")}</Label>
                      <Segmented
                        value={style}
                        onChange={setStyle}
                        options={[
                          { value: "lines", label: t("wizard.styleLines") },
                          { value: "dots", label: t("wizard.styleDots") },
                        ]}
                      />
                    </div>
                    <div>
                      <Label>{t("wizard.gridColor")}</Label>
                      <ColorField value={gridColor} onChange={setGridColor} />
                    </div>
                  </div>
                  <p className="text-sm text-amber-200">
                    {t("wizard.gridResult", { cols: Math.round((w / size) * 10) / 10, rows: Math.round((h / size) * 10) / 10 })}
                  </p>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label>{t("wizard.mapName")}</Label>
                <input
                  autoFocus
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("wizard.defaultName")}
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-slate-100 ring-1 ring-slate-700 outline-none focus:ring-amber-500"
                  onKeyDown={(e) => e.key === "Enter" && void create()}
                />
              </div>
              <div>
                <Label>{t("wizard.background")}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {BG_SWATCHES.map((c) => (
                    <button key={c} onClick={() => setBg(c)} className={cx("h-8 w-8 rounded-md ring-2", bg === c ? "ring-amber-500" : "ring-slate-700")} style={{ background: c }} />
                  ))}
                  <ColorField value={bg} onChange={setBg} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900 p-3">
          <MapThumbnail doc={preview} id="wizard" className="max-h-48 w-full" />
          <div className="mt-2 text-center text-xs text-slate-400">
            {w} × {h} px
            {useGrid && (
              <>
                <br />
                {Math.round((w / size) * 10) / 10} × {Math.round((h / size) * 10) / 10} {t("common.cells")}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-between gap-2">
        <Button onClick={() => (step === 1 ? close() : setStep(step - 1))}>{step === 1 ? t("common.cancel") : t("common.back")}</Button>
        {step < 3 ? (
          <Button variant="primary" onClick={() => setStep(step + 1)}>
            {t("common.next")}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void create()} disabled={busy}>
            {t("wizard.createBtn")}
          </Button>
        )}
      </div>
    </Modal>
  );
}
