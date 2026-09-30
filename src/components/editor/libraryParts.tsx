"use client";

// Pieces shared by the library tab, the background tab and the brush texture picker.

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAssets } from "@/lib/client/assets";
import { useSession } from "@/lib/client/session";
import type { AssetGroupInfo, PatternDef } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/controls";

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

/** Collapse state of library sections, remembered in this browser (keys: "a:<group>", "p:<group>", …). */
export function useCollapsed() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = { ...c, [key]: !c[key] };
      saveCollapsed(next);
      return next;
    });
  return [collapsed, toggle] as const;
}

/** Collapsible header shared by asset and texture groups. */
export function GroupHeader({ group, open, count, onToggle }: { group: AssetGroupInfo; open: boolean; count: number; onToggle: () => void }) {
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

export function LibraryStatus() {
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

/** Square preview of a texture tile (2 × 2 repeats). */
export function PatternSwatch({ pattern, idPrefix, className }: { pattern: PatternDef; idPrefix: string; className?: string }) {
  const id = `${idPrefix}-${pattern.id}`;
  return (
    <svg viewBox={`0 0 ${pattern.size * 2} ${pattern.size * 2}`} className={cx("aspect-square w-full", className)}>
      <defs>
        <pattern id={id} width={pattern.size} height={pattern.size} patternUnits="userSpaceOnUse">
          <g dangerouslySetInnerHTML={{ __html: pattern.body }} />
        </pattern>
      </defs>
      <rect width={pattern.size * 2} height={pattern.size * 2} fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * Library textures, one collapsible section per asset group; locked groups show what an
 * account unlocks. Used for the map background and for brush textures.
 */
export function TextureGrid({
  value,
  onPick,
  testPrefix,
  idPrefix = "thumb",
}: {
  value: string | null | undefined;
  onPick: (id: string) => void;
  testPrefix: string;
  idPrefix?: string;
}) {
  const { t, lang } = useI18n();
  const groups = useAssets((s) => s.groups);
  const patterns = useAssets((s) => s.patterns);
  const locked = useAssets((s) => s.locked);
  const [collapsed, toggle] = useCollapsed();
  const textureGroups = groups.filter((g) => g.patternCount > 0);
  return (
    <>
      {textureGroups.map((g) => {
        const open = !collapsed[`p:${g.id}`];
        const items = g.locked ? locked.filter((c) => c.group === g.id && c.kind === "pattern") : patterns.filter((p) => p.group === g.id && !p.hidden);
        return (
          <section key={g.id} data-testid={`${testPrefix}-${g.id}`}>
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
                        type="button"
                        onClick={() => onPick(p.id)}
                        title={p.name[lang]}
                        data-pattern-id={p.id}
                        aria-pressed={value === p.id}
                        className={cx("relative overflow-hidden rounded-lg ring-2", value === p.id ? "ring-amber-500" : "ring-transparent hover:ring-slate-600")}
                      >
                        <PatternSwatch pattern={p} idPrefix={idPrefix} />
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white">{p.name[lang]}</span>
                      </button>
                    ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
