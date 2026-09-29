"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useEditor } from "@/lib/editor/store";

export default function StatusBar() {
  const { t } = useI18n();
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const zoom = useEditor((s) => s.view.zoom);
  const count = useEditor((s) => s.doc?.elements.length ?? 0);
  const sel = useEditor((s) => s.selection.length);
  const grid = useEditor((s) => s.doc?.grid.size ?? 70);
  const size = useEditor((s) => (s.doc ? `${s.doc.width} × ${s.doc.height}` : ""));

  useEffect(() => {
    const on = (e: Event) => setCursor((e as CustomEvent).detail);
    window.addEventListener("mapforge:cursor", on);
    return () => window.removeEventListener("mapforge:cursor", on);
  }, []);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-5 border-t border-slate-700 bg-slate-900 px-3 text-[11px] tabular-nums text-slate-400">
      <span>{size} px</span>
      {cursor && (
        <>
          <span>
            {t("editor.statusBar.cursor")}: {Math.round(cursor.x)}, {Math.round(cursor.y)}
          </span>
          <span>
            {t("editor.statusBar.cell")}: {Math.floor(cursor.x / grid) + 1}, {Math.floor(cursor.y / grid) + 1}
          </span>
        </>
      )}
      <span>
        {t("editor.statusBar.zoom")}: {Math.round(zoom * 100)}%
      </span>
      <span>
        {t("editor.statusBar.elements")}: {count}
        {sel > 0 && ` · ${t("editor.props.selected", { n: sel })}`}
      </span>
      <span className="ml-auto hidden md:inline">{t("editor.statusBar.hints")}</span>
    </footer>
  );
}
