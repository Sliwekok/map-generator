"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useEditor, type Tool } from "@/lib/editor/store";
import { flushSave, zoomCenter, zoomTo } from "@/lib/editor/hooks";
import { Icon } from "@/components/ui/Icon";
import { cx, IconButton } from "@/components/ui/controls";

const TOOLS: { id: Tool; icon: string; key: TKey }[] = [
  { id: "select", icon: "select", key: "editor.tools.select" },
  { id: "pan", icon: "hand", key: "editor.tools.pan" },
  { id: "text", icon: "text", key: "editor.tools.text" },
  { id: "rect", icon: "rect", key: "editor.tools.rect" },
  { id: "ellipse", icon: "ellipse", key: "editor.tools.ellipse" },
  { id: "pen", icon: "pen", key: "editor.tools.pen" },
  { id: "brush", icon: "brush", key: "editor.tools.brush" },
  { id: "eraser", icon: "eraser", key: "editor.tools.eraser" },
  { id: "measure", icon: "ruler", key: "editor.tools.measure" },
];

export default function Toolbar({ onSettings, onExport }: { onSettings: () => void; onExport: () => void }) {
  const { t } = useI18n();
  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.view.zoom);
  const showGrid = useEditor((s) => s.showGrid);
  const snap = useEditor((s) => s.snap);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const name = useEditor((s) => s.doc?.name ?? "");
  const s = useEditor.getState;

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-slate-700 bg-slate-900 px-2">
      <Link href="/maps" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-300 hover:bg-slate-800" title={t("editor.backToMaps")}>
        <Icon name="arrowLeft" size={18} />
        <span className="hidden font-display font-semibold text-amber-400 lg:inline">MapForge</span>
      </Link>
      <NameInput value={name} />
      <Divider />
      <div className="flex items-center gap-0.5">
        {TOOLS.map((x) => (
          <IconButton key={x.id} icon={x.icon} title={t(x.key)} active={tool === x.id} onClick={() => s().setTool(x.id)} />
        ))}
      </div>
      <Divider />
      <IconButton icon="undo" title={t("editor.undo")} disabled={!canUndo} onClick={() => s().undo()} />
      <IconButton icon="redo" title={t("editor.redo")} disabled={!canRedo} onClick={() => s().redo()} />
      <Divider />
      <IconButton icon="zoomOut" title={t("editor.zoomOut")} onClick={() => zoomCenter(1 / 1.25)} />
      <button
        className="w-14 rounded-md py-1 text-center text-xs tabular-nums text-slate-300 hover:bg-slate-800"
        title={t("editor.zoom100")}
        onClick={() => zoomTo(1)}
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton icon="zoomIn" title={t("editor.zoomIn")} onClick={() => zoomCenter(1.25)} />
      <IconButton icon="fit" title={t("editor.zoomFit")} onClick={() => window.dispatchEvent(new Event("mapforge:fit"))} />
      <Divider />
      <IconButton icon="grid" title={t("editor.toggleGrid")} active={showGrid} onClick={() => s().setShowGrid(!showGrid)} />
      <IconButton icon="magnet" title={t("editor.toggleSnap")} active={snap} onClick={() => s().setSnap(!snap)} />
      <IconButton icon="settings" title={t("editor.settings")} onClick={onSettings} />
      <div className="flex-1" />
      <SaveIndicator />
      <button
        onClick={onExport}
        className="ml-2 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
      >
        <Icon name="download" size={16} /> <span className="hidden md:inline">{t("editor.export")}</span>
      </button>
      <Link href="/help" target="_blank" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800" title={t("editor.help")}>
        <Icon name="help" size={18} />
      </Link>
      <Link href="/settings" target="_blank" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800" title={t("nav.settings")}>
        <Icon name="sliders" size={18} />
      </Link>
    </header>
  );
}

function Divider() {
  return <div className="mx-1 h-6 w-px bg-slate-700" />;
}

function NameInput({ value }: { value: string }) {
  const { t } = useI18n();
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value);
  }
  const commit = () => {
    const v = text.trim().slice(0, 80) || t("editor.untitled");
    if (v !== value) useEditor.getState().setDoc((d) => ({ ...d, name: v }));
    else setText(value);
  };
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      maxLength={80}
      className="w-44 rounded-md bg-transparent px-2 py-1.5 text-sm font-medium text-slate-100 outline-none ring-1 ring-transparent hover:ring-slate-700 focus:bg-slate-800 focus:ring-amber-500"
      aria-label="Map name"
    />
  );
}

function SaveIndicator() {
  const { t } = useI18n();
  const state = useEditor((s) => s.saveState);
  const source = useEditor((s) => s.source);
  const color = {
    saved: "text-emerald-400",
    saving: "text-sky-300",
    pending: "text-slate-400",
    error: "text-red-400",
    offline: "text-orange-300",
    conflict: "text-red-400",
  }[state];
  return (
    <button
      onClick={() => void flushSave()}
      title={`${t(`editor.status.${state}` as TKey)} ${state === "saved" ? (source === "cloud" ? t("editor.savedCloud") : t("editor.savedLocal")) : ""}`}
      className={cx("hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs sm:flex", color)}
      data-testid="save-state"
      data-state={state}
    >
      <Icon name={source === "cloud" ? "cloud" : "laptop"} size={15} />
      <span className="hidden xl:inline">{t(`editor.status.${state}` as TKey)}</span>
      <span className={cx("h-2 w-2 rounded-full", state === "saving" ? "animate-pulse bg-sky-300" : "bg-current")} />
    </button>
  );
}
