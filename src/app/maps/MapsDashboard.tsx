"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/client/session";
import { useAssets } from "@/lib/client/assets";
import { useUploads, dataUrlToFile } from "@/lib/client/uploads";
import { localDb } from "@/lib/client/localDb";
import { ApiError } from "@/lib/client/api";
import { contentOf, createMap, deleteMap, LimitError, listCloudMaps, listLocalMaps, renameMap } from "@/lib/client/repo";
import { toast } from "@/lib/client/toasts";
import { parseProject } from "@/lib/editor/export";
import { LIMITS } from "@/lib/limits";
import type { MapContent, MapDoc, SessionUser } from "@/lib/types";
import { Button } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import MapThumbnail from "@/components/map/MapThumbnail";
import NewMapWizard from "@/components/NewMapWizard";

function remapUploads(content: MapContent, mapping: Record<string, string>): MapContent {
  return {
    ...content,
    elements: content.elements.map((e) =>
      e.type === "asset" && e.assetId.startsWith("u:") && mapping[e.assetId.slice(2)]
        ? { ...e, assetId: `u:${mapping[e.assetId.slice(2)]}` }
        : e,
    ),
  };
}

async function uploadForImport(user: SessionUser | null, files: { id: string; file: File }[]) {
  const mapping: Record<string, string> = {};
  for (const f of files) {
    try {
      const info = await useUploads.getState().upload(user, f.file);
      mapping[f.id] = info.id;
    } catch {
      /* missing images show as placeholders */
    }
  }
  return mapping;
}

export default function MapsDashboard({ openWizard = false }: { openWizard?: boolean }) {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const router = useRouter();
  const [local, setLocal] = useState<MapDoc[] | null>(null);
  const [cloud, setCloud] = useState<MapDoc[] | null>(null);
  const [wizard, setWizard] = useState(openWizard);
  const [reloadKey, setReloadKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const [dbDown, setDbDown] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    listLocalMaps()
      .catch(() => [] as MapDoc[])
      .then((maps) => !cancelled && setLocal(maps));
    if (user) {
      listCloudMaps()
        .then((maps) => {
          if (cancelled) return;
          setCloud(maps);
          setDbDown(false);
        })
        .catch((e) => {
          if (cancelled) return;
          setCloud([]);
          setDbDown(e instanceof ApiError && e.status === 503);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  useEffect(() => {
    void useAssets.getState().loadPremium(user);
    void useUploads.getState().load(user);
  }, [user]);

  useEffect(() => {
    if (openWizard) window.history.replaceState(null, "", "/maps");
  }, [openWizard]);

  const cloudMaps = user ? cloud : null;
  const mine = user ? cloudMaps ?? [] : local ?? [];
  const max = user ? LIMITS.user.maxMaps : LIMITS.anonymous.maxMaps;
  const atLimit = mine.length >= max;

  const onDelete = async (m: MapDoc) => {
    if (!confirm(t("common.confirmDelete", { name: m.name }))) return;
    await deleteMap(m.id).catch(() => toast(t("common.errorGeneric"), "error"));
    void refresh();
  };

  const onRename = async (m: MapDoc) => {
    const name = prompt(t("common.rename"), m.name)?.trim();
    if (!name || name === m.name) return;
    await renameMap(m, name.slice(0, 80)).catch(() => toast(t("common.errorGeneric"), "error"));
    void refresh();
  };

  const onDuplicate = async (m: MapDoc) => {
    try {
      const target = m.source === "local" ? null : user;
      await createMap(target, { ...contentOf(m), name: `${m.name} (2)`.slice(0, 80) });
      void refresh();
    } catch (e) {
      toast(e instanceof LimitError ? t("maps.limitReached", { max: e.limit }) : t("common.errorGeneric"), "error");
    }
  };

  const importLocal = async () => {
    if (!user || !local?.length) return;
    setImporting(true);
    let n = 0;
    try {
      for (const m of local) {
        const ids = [...new Set(m.elements.flatMap((e) => (e.type === "asset" && e.assetId.startsWith("u:lu_") ? [e.assetId.slice(2)] : [])))];
        const files: { id: string; file: File }[] = [];
        for (const id of ids) {
          const row = await localDb.getUpload(id);
          if (row) files.push({ id, file: new File([row.blob], row.name, { type: row.contentType }) });
        }
        const mapping = await uploadForImport(user, files);
        await createMap(user, remapUploads(contentOf(m), mapping));
        await localDb.deleteMap(m.id);
        n++;
      }
      toast(t("maps.imported", { n }), "success");
    } catch (e) {
      toast(e instanceof LimitError ? t("maps.limitReached", { max: e.limit }) : t("common.errorGeneric"), "error");
    } finally {
      setImporting(false);
      void refresh();
    }
  };

  const importProjectFile = async (file: File) => {
    try {
      const project = parseProject(await file.text());
      const files = Object.entries(project.uploads).map(([id, u]) => ({ id, file: dataUrlToFile(u.dataUrl, u.name) }));
      const mapping = await uploadForImport(user, files);
      const doc = await createMap(user, remapUploads(project.map, mapping));
      toast(t("editor.exportDlg.importOk"), "success");
      router.push(`/editor/${doc.id}`);
    } catch (e) {
      toast(e instanceof LimitError ? t("maps.limitReached", { max: e.limit }) : t("editor.exportDlg.importFail"), "error");
    }
  };

  const card = (m: MapDoc) => (
    <div key={m.id} className="group overflow-hidden rounded-xl bg-slate-800 ring-1 ring-slate-700 transition hover:ring-amber-500">
      <Link href={`/editor/${m.id}`} className="block bg-slate-900 p-3">
        <MapThumbnail doc={m} id={m.id} className="mx-auto h-40 w-full" />
      </Link>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/editor/${m.id}`} className="line-clamp-1 font-semibold text-slate-100 hover:text-amber-400">
            {m.name}
          </Link>
          <span
            className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400"
            title={m.source === "cloud" ? t("maps.storedCloud") : t("maps.storedLocal")}
          >
            <Icon name={m.source === "cloud" ? "cloud" : "laptop"} size={12} />
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {m.width} × {m.height} px{m.grid.enabled ? ` · ${m.grid.size} px grid` : ""}
        </div>
        <div className="text-xs text-slate-500">
          {t("maps.updated", { date: new Date(m.updatedAt).toLocaleString(lang === "pl" ? "pl-PL" : "en-GB") })}
        </div>
        <div className="mt-3 flex gap-1">
          <Link href={`/editor/${m.id}`} className="flex-1 rounded-md bg-amber-500 py-1.5 text-center text-sm font-semibold text-slate-950 hover:bg-amber-400">
            {t("common.open")}
          </Link>
          <button title={t("common.rename")} onClick={() => onRename(m)} className="rounded-md bg-slate-700 px-2 text-slate-200 hover:bg-slate-600">
            <Icon name="text" size={15} />
          </button>
          <button title={t("common.duplicate")} onClick={() => onDuplicate(m)} className="rounded-md bg-slate-700 px-2 text-slate-200 hover:bg-slate-600">
            <Icon name="copy" size={15} />
          </button>
          <button title={t("common.delete")} onClick={() => onDelete(m)} className="rounded-md bg-slate-700 px-2 text-red-300 hover:bg-red-600 hover:text-white">
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  const loading = local === null || (user && cloudMaps === null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-slate-100">{t("maps.title")}</h1>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300" data-testid="map-usage">
          {t("maps.usage", { used: mine.length, max })}
        </span>
        <div className="flex-1" />
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importProjectFile(f);
          }}
        />
        <Button onClick={() => fileInput.current?.click()} disabled={atLimit}>
          <Icon name="upload" size={16} /> {t("editor.exportDlg.importJson")}
        </Button>
        <Button variant="primary" onClick={() => setWizard(true)} disabled={atLimit} data-testid="new-map">
          <Icon name="plus" size={16} /> {t("maps.newMap")}
        </Button>
      </div>

      {dbDown && <div className="mb-4 rounded-lg bg-red-900/60 p-3 text-sm text-red-100">{t("common.dbUnavailable")}</div>}

      {atLimit && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          {user ? (
            t("maps.limitReached", { max })
          ) : (
            <>
              {t("maps.limitGuest", { max, userMax: LIMITS.user.maxMaps })}{" "}
              <Link href="/register" className="font-semibold underline">
                {t("nav.register")}
              </Link>
            </>
          )}
        </div>
      )}

      {user && local && local.length > 0 && (
        <div className="mb-8 rounded-xl bg-slate-800/60 p-4 ring-1 ring-slate-700">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-slate-100">{t("maps.importTitle")}</h2>
            <span className="text-sm text-slate-400">{t("maps.importText", { n: local.length })}</span>
            <div className="flex-1" />
            <Button variant="primary" onClick={importLocal} disabled={importing}>
              <Icon name="cloud" size={16} /> {importing ? t("maps.importing") : t("maps.importBtn")}
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{local.map(card)}</div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : mine.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
          <p className="mb-4 text-slate-400">{t("maps.empty")}</p>
          <Button variant="primary" onClick={() => setWizard(true)}>
            <Icon name="plus" size={16} /> {t("maps.newMap")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{mine.map(card)}</div>
      )}

      <NewMapWizard open={wizard} onClose={() => setWizard(false)} />
    </div>
  );
}
