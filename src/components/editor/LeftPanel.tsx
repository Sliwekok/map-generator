"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useAssets } from "@/lib/client/assets";
import { useSession } from "@/lib/client/session";
import { useEditor } from "@/lib/editor/store";
import { assetElement, uploadElement } from "@/lib/editor/factory";
import { ASSET_CATEGORIES, type AssetCategory, type AssetDef, type UploadInfo } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { ColorField, cx, Label, Slider } from "@/components/ui/controls";
import FileBrowser from "@/components/files/FileBrowser";
import { ASSET_MIME } from "./EditorCanvas";

type Tab = "library" | "uploads" | "background";

/**
 * Where a click-added item goes: the centre of the view, cascading one cell
 * diagonally while that spot is already occupied so items don't stack.
 */
function viewCenter() {
  const s = useEditor.getState();
  const el = document.querySelector('[data-testid="editor-canvas"]');
  const w = el?.clientWidth ?? 800;
  const h = el?.clientHeight ?? 600;
  const base = { x: (w / 2 - s.view.x) / s.view.zoom, y: (h / 2 - s.view.y) / s.view.zoom };
  const g = s.doc?.grid.size || 70;
  const els = s.doc?.elements ?? [];
  for (let i = 0; i < 16; i++) {
    const p = { x: base.x + (i % 4) * g * 1.5, y: base.y + Math.floor(i / 4) * g * 1.5 };
    const taken = els.some((e) => p.x >= e.x - g * 0.25 && p.x <= e.x + e.width + g * 0.25 && p.y >= e.y - g * 0.25 && p.y <= e.y + e.height + g * 0.25);
    if (!taken) return p;
  }
  return base;
}

export default function LeftPanel() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("library");
  const tabs: { id: Tab; label: TKey; icon: string }[] = [
    { id: "library", label: "editor.panels.library", icon: "star" },
    { id: "uploads", label: "editor.panels.uploads", icon: "image" },
    { id: "background", label: "editor.panels.background", icon: "map" },
  ];
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-700 bg-slate-900">
      <div className="flex border-b border-slate-700">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold",
              tab === x.id ? "border-b-2 border-amber-500 text-amber-400" : "text-slate-400 hover:text-slate-200",
            )}
          >
            <Icon name={x.icon} size={15} />
            {t(x.label)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "library" && <Library />}
        {tab === "uploads" && <Uploads />}
        {tab === "background" && <Background />}
      </div>
    </aside>
  );
}

function AssetThumb({ asset }: { asset: AssetDef }) {
  return (
    <svg viewBox={asset.viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet" style={{ color: asset.defaultTint ?? "#444" }}>
      <g dangerouslySetInnerHTML={{ __html: asset.body }} />
    </svg>
  );
}

function Library() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const assets = useAssets((s) => s.assets);
  const catalog = useAssets((s) => s.catalog);
  const [cat, setCat] = useState<AssetCategory | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      assets.filter(
        (a) =>
          (cat === "all" || a.category === cat) &&
          (!q || a.name[lang].toLowerCase().includes(q.toLowerCase()) || a.name.en.toLowerCase().includes(q.toLowerCase())),
      ),
    [assets, cat, q, lang],
  );
  const lockedCount = user ? 0 : catalog.length;

  const add = (a: AssetDef) => {
    const s = useEditor.getState();
    if (s.doc) s.addElements([assetElement(a, viewCenter(), s.doc, s.snap)]);
  };

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("editor.library.search")}
        className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700 outline-none focus:ring-amber-500"
      />
      <div className="flex flex-wrap gap-1">
        {(["all", ...ASSET_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cx(
              "rounded-full px-2.5 py-1 text-xs",
              cat === c ? "bg-amber-500 font-semibold text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700",
            )}
          >
            {c === "all" ? t("editor.library.all") : t(`editor.library.categories.${c}` as TKey)}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">{t("editor.library.hint")}</p>
      <div className="grid grid-cols-3 gap-2">
        {filtered.map((a) => (
          <button
            key={a.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(ASSET_MIME, a.id);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => add(a)}
            title={a.name[lang]}
            className="group relative flex flex-col items-center gap-1 rounded-lg bg-slate-800 p-1.5 ring-1 ring-slate-700 hover:ring-amber-500"
          >
            <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded bg-[#e8dcc0] p-1">
              <AssetThumb asset={a} />
            </div>
            <span className="line-clamp-1 w-full text-center text-[10px] text-slate-300">{a.name[lang]}</span>
            {a.premium && (
              <span className="absolute right-1 top-1 rounded bg-amber-500 px-1 text-[9px] font-bold text-slate-950">★</span>
            )}
          </button>
        ))}
      </div>
      {!filtered.length && <p className="text-sm text-slate-500">{t("editor.library.noResults")}</p>}
      {lockedCount > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Icon name="lock" size={16} /> {t("editor.library.premium")}
          </div>
          <p className="mb-2 text-xs">{t("editor.library.locked", { n: lockedCount })}</p>
          <div className="mb-3 flex flex-wrap gap-1">
            {catalog.slice(0, 12).map((c) => (
              <span key={c.id} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                🔒 {c.name[lang]}
              </span>
            ))}
            {catalog.length > 12 && <span className="text-[10px] text-slate-400">+{catalog.length - 12}</span>}
          </div>
          <Link href="/login" className="inline-block rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950">
            {t("editor.library.lockedCta")}
          </Link>
        </div>
      )}
    </div>
  );
}

function Uploads() {
  const { t } = useI18n();
  const { user } = useSession();

  const add = (u: UploadInfo) => {
    const s = useEditor.getState();
    if (s.doc) s.addElements([uploadElement(u, viewCenter(), s.doc, s.snap)]);
  };

  if (!user) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100" data-testid="uploads-login">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <Icon name="lock" size={16} /> {t("files.loginTitle")}
        </div>
        <p className="mb-3 text-xs">{t("files.loginText")}</p>
        <div className="flex gap-2">
          <Link href="/login" className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950">
            {t("nav.login")}
          </Link>
          <Link href="/register" className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100">
            {t("nav.register")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FileBrowser variant="panel" onPick={add} assetMime={ASSET_MIME} />
      <Link href="/files" target="_blank" className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400">
        <Icon name="folder" size={13} /> {t("files.title")} ↗
      </Link>
    </div>
  );
}

function Background() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const doc = useEditor((s) => s.doc);
  const setDoc = useEditor((s) => s.setDoc);
  const beginGesture = useEditor((s) => s.beginGesture);
  const endGesture = useEditor((s) => s.endGesture);
  const patterns = useAssets((s) => s.patterns);
  const catalog = useAssets((s) => s.catalog);
  if (!doc) return null;
  const bg = doc.background;
  const setBg = (patch: Partial<typeof bg>, history = true) =>
    setDoc((d) => ({ ...d, background: { ...d.background, ...patch } }), { history });
  const lockedPatterns = user ? [] : catalog.filter((c) => c.kind === "pattern");

  return (
    <div className="space-y-4">
      <div>
        <Label>{t("editor.bg.color")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <ColorField value={bg.color} onChange={(c) => setBg({ color: c })} />
          {["#e8dcc0", "#ffffff", "#7fae4e", "#55504a", "#2b2522", "#3f7fb5"].map((c) => (
            <button key={c} onClick={() => setBg({ color: c })} className="h-6 w-6 rounded ring-1 ring-slate-600" style={{ background: c }} title={c} />
          ))}
        </div>
      </div>
      <div>
        <Label>{t("editor.bg.pattern")}</Label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setBg({ pattern: null })}
            className={cx(
              "flex aspect-square items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-300 ring-2",
              !bg.pattern ? "ring-amber-500" : "ring-transparent hover:ring-slate-600",
            )}
          >
            {t("editor.bg.none")}
          </button>
          {patterns.map((p) => (
            <button
              key={p.id}
              onClick={() => setBg({ pattern: p.id })}
              title={p.name[lang]}
              className={cx("relative overflow-hidden rounded-lg ring-2", bg.pattern === p.id ? "ring-amber-500" : "ring-transparent hover:ring-slate-600")}
            >
              <svg viewBox={`0 0 ${p.size * 2} ${p.size * 2}`} className="aspect-square w-full">
                <defs>
                  <pattern id={`thumb-${p.id}`} width={p.size} height={p.size} patternUnits="userSpaceOnUse">
                    <g dangerouslySetInnerHTML={{ __html: p.body }} />
                  </pattern>
                </defs>
                <rect width={p.size * 2} height={p.size * 2} fill={`url(#thumb-${p.id})`} />
              </svg>
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white">{p.name[lang]}</span>
            </button>
          ))}
          {lockedPatterns.map((p) => (
            <Link
              key={p.id}
              href="/login"
              title={t("editor.library.lockedCta")}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-slate-800/60 text-center text-[10px] text-slate-500 ring-1 ring-slate-700"
            >
              <Icon name="lock" size={16} />
              {p.name[lang]}
            </Link>
          ))}
        </div>
      </div>
      {bg.pattern && (
        <div>
          <Label>
            {t("editor.bg.scale")}: {bg.patternScale.toFixed(2)}×
          </Label>
          <Slider
            value={bg.patternScale}
            min={0.25}
            max={6}
            step={0.25}
            onStart={beginGesture}
            onEnd={endGesture}
            onChange={(v) => setBg({ patternScale: v }, false)}
          />
        </div>
      )}
    </div>
  );
}
