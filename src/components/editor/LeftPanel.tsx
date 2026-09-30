"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useAssets } from "@/lib/client/assets";
import { useSession } from "@/lib/client/session";
import { useEditor } from "@/lib/editor/store";
import { assetElement, uploadElement } from "@/lib/editor/factory";
import type { AssetDef, AssetGroupInfo, CatalogItem, I18nText, PatternDef, UploadInfo } from "@/lib/types";
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

/** Items rendered per group before "Show all" - keeps big libraries fast. */
const GROUP_PAGE = 60;
const COLLAPSED_KEY = "mf_lib_collapsed";

function readCollapsed(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function saveCollapsed(v: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(v));
  } catch {
    /* private mode etc. - collapse state just isn't remembered */
  }
}

const matches = (needle: string, name: I18nText, tags?: string[]) =>
  !needle ||
  name.en.toLowerCase().includes(needle) ||
  name.pl.toLowerCase().includes(needle) ||
  !!tags?.some((x) => x.includes(needle));

/** Collapsible header shared by asset and texture groups. */
function GroupHeader({ group, open, count, onToggle }: { group: AssetGroupInfo; open: boolean; count: number; onToggle: () => void }) {
  const { t, lang } = useI18n();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title={group.description?.[lang] ?? group.name[lang]}
      data-testid={`group-toggle-${group.id}`}
      className="flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs font-semibold text-slate-300 hover:text-slate-100"
    >
      <Icon name={open ? "chevronDown" : "chevronRight"} size={14} className="shrink-0 text-slate-500" />
      <span className="min-w-0 flex-1 truncate">{group.name[lang]}</span>
      {group.locked && (
        <span className="flex items-center gap-0.5 text-[10px] font-normal text-amber-400" title={t("editor.library.lockedCta")}>
          <Icon name="lock" size={12} />
        </span>
      )}
      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal text-slate-400">{count}</span>
    </button>
  );
}

function LockedGroup({ items, count }: { items: CatalogItem[]; count: number }) {
  const { t, lang } = useI18n();
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
      <p className="mb-2 text-xs">{t("editor.library.groupLocked", { n: count })}</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {items.slice(0, 12).map((c) => (
          <span key={c.id} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            🔒 {c.name[lang]}
          </span>
        ))}
        {items.length > 12 && <span className="text-[10px] text-slate-400">+{items.length - 12}</span>}
      </div>
      <Link href="/login" className="inline-block rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950">
        {t("editor.library.lockedCta")}
      </Link>
    </div>
  );
}

function LibraryStatus() {
  const { t } = useI18n();
  const { user } = useSession();
  const status = useAssets((s) => s.status);
  if (status === "error") {
    return (
      <div className="rounded-lg bg-red-900/40 p-3 text-xs text-red-100">
        <p className="mb-2">{t("editor.library.loadError")}</p>
        <button onClick={() => void useAssets.getState().load(user, { force: true })} className="rounded bg-slate-700 px-2 py-1 font-semibold">
          {t("editor.library.retry")}
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2" aria-label={t("editor.library.loading")}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="h-[88px] animate-pulse rounded-lg bg-slate-800" />
      ))}
    </div>
  );
}

function useCollapsed() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = { ...c, [key]: !c[key] };
      saveCollapsed(next);
      return next;
    });
  return [collapsed, toggle] as const;
}

function Library() {
  const { t, lang } = useI18n();
  const status = useAssets((s) => s.status);
  const groups = useAssets((s) => s.groups);
  const assets = useAssets((s) => s.assets);
  const locked = useAssets((s) => s.locked);
  const categories = useAssets((s) => s.categories);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [collapsed, toggle] = useCollapsed();
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const needle = q.trim().toLowerCase();
  const filtering = !!needle || cat !== "all";

  // Listed assets / locked catalog entries bucketed by group once per library load.
  const byGroup = useMemo(() => {
    const m = new Map<string, { items: AssetDef[]; locked: CatalogItem[] }>();
    const slot = (g: string) => m.get(g) ?? (m.set(g, { items: [], locked: [] }), m.get(g)!);
    for (const a of assets) if (!a.hidden) slot(a.group).items.push(a);
    for (const c of locked) if (c.kind === "asset") slot(c.group).locked.push(c);
    return m;
  }, [assets, locked]);

  // Only categories that have something in them.
  const usedCats = useMemo(() => {
    const used = new Set<string>();
    for (const { items, locked: l } of byGroup.values()) {
      for (const a of items) used.add(a.category);
      for (const c of l) used.add(c.category);
    }
    return categories.filter((c) => used.has(c.id));
  }, [byGroup, categories]);

  const sections = useMemo(
    () =>
      groups
        .filter((g) => g.assetCount > 0)
        .map((g) => {
          const b = byGroup.get(g.id) ?? { items: [], locked: [] };
          const keep = (x: { category: string; name: I18nText; tags?: string[] }) => (cat === "all" || x.category === cat) && matches(needle, x.name, x.tags);
          const items = g.locked ? [] : b.items.filter(keep);
          const lockedItems = g.locked ? b.locked.filter(keep) : [];
          return { g, items, lockedItems, count: g.locked ? lockedItems.length : items.length };
        })
        .filter((x) => !filtering || x.count > 0),
    [groups, byGroup, cat, needle, filtering],
  );

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
        {[{ id: "all", name: null as I18nText | null }, ...usedCats].map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={cx(
              "rounded-full px-2.5 py-1 text-xs",
              cat === c.id ? "bg-amber-500 font-semibold text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700",
            )}
          >
            {c.name ? c.name[lang] : t("editor.library.all")}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">{t("editor.library.hint")}</p>
      {status !== "ready" ? (
        <LibraryStatus />
      ) : (
        sections.map(({ g, items, lockedItems, count }) => {
          const open = filtering || !collapsed[`a:${g.id}`];
          const shown = showAll[g.id] ? items : items.slice(0, GROUP_PAGE);
          return (
            <section key={g.id} data-testid={`asset-group-${g.id}`}>
              <GroupHeader group={g} open={open} count={count} onToggle={() => toggle(`a:${g.id}`)} />
              {open && (
                <div className="mt-1.5">
                  {g.locked ? (
                    <LockedGroup items={lockedItems} count={count} />
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {shown.map((a) => (
                          <button
                            key={a.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(ASSET_MIME, a.id);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => add(a)}
                            title={a.name[lang]}
                            data-asset-id={a.id}
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
                      {items.length > shown.length && (
                        <button
                          onClick={() => setShowAll((s) => ({ ...s, [g.id]: true }))}
                          className="mt-2 w-full rounded-md bg-slate-800 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                        >
                          {t("editor.library.showAll", { n: items.length })}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })
      )}
      {status === "ready" && !sections.length && <p className="text-sm text-slate-500">{t("editor.library.noResults")}</p>}
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
  const doc = useEditor((s) => s.doc);
  const setDoc = useEditor((s) => s.setDoc);
  const beginGesture = useEditor((s) => s.beginGesture);
  const endGesture = useEditor((s) => s.endGesture);
  const status = useAssets((s) => s.status);
  const groups = useAssets((s) => s.groups);
  const patterns = useAssets((s) => s.patterns);
  const locked = useAssets((s) => s.locked);
  const [collapsed, toggle] = useCollapsed();
  if (!doc) return null;
  const bg = doc.background;
  const setBg = (patch: Partial<typeof bg>, history = true) =>
    setDoc((d) => ({ ...d, background: { ...d.background, ...patch } }), { history });
  const textureGroups = groups.filter((g) => g.patternCount > 0);

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
      <div className="space-y-2">
        <Label>{t("editor.bg.pattern")}</Label>
        <button
          onClick={() => setBg({ pattern: null })}
          className={cx(
            "w-full rounded-lg bg-slate-800 py-2 text-xs text-slate-300 ring-2",
            !bg.pattern ? "ring-amber-500" : "ring-transparent hover:ring-slate-600",
          )}
        >
          {t("editor.bg.none")}
        </button>
        {status !== "ready" && <LibraryStatus />}
        {textureGroups.map((g) => {
          const open = !collapsed[`p:${g.id}`];
          const items = g.locked
            ? locked.filter((c) => c.group === g.id && c.kind === "pattern")
            : patterns.filter((p) => p.group === g.id && !p.hidden);
          return (
            <section key={g.id} data-testid={`texture-group-${g.id}`}>
              <GroupHeader group={g} open={open} count={items.length} onToggle={() => toggle(`p:${g.id}`)} />
              {open && (
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {g.locked
                    ? items.map((p) => (
                        <Link
                          key={p.id}
                          href="/login"
                          title={t("editor.library.lockedCta")}
                          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-slate-800/60 text-center text-[10px] text-slate-500 ring-1 ring-slate-700"
                        >
                          <Icon name="lock" size={16} />
                          {p.name[lang]}
                        </Link>
                      ))
                    : (items as PatternDef[]).map((p) => (
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
                </div>
              )}
            </section>
          );
        })}
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
