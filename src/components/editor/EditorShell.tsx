"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/client/session";
import { useAssets } from "@/lib/client/assets";
import { useUploads } from "@/lib/client/uploads";
import { loadMap } from "@/lib/client/repo";
import { useEditor } from "@/lib/editor/store";
import { flushSave, useAutosave, useShortcuts } from "@/lib/editor/hooks";
import { Button } from "@/components/ui/controls";
import EditorCanvas from "./EditorCanvas";
import Toolbar from "./Toolbar";
import LeftPanel from "./LeftPanel";
import RightPanel from "./RightPanel";
import StatusBar from "./StatusBar";
import MapSettingsDialog from "./MapSettingsDialog";
import ExportDialog from "./ExportDialog";

export default function EditorShell({ id }: { id: string }) {
  const { t } = useI18n();
  const { user } = useSession();
  const [result, setResult] = useState<{ id: string; status: "ready" | "missing" | "error" } | null>(null);
  const status = result?.id === id ? result.status : "loading";
  const [settings, setSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const saveState = useEditor((s) => s.saveState);

  useAutosave();
  useShortcuts();

  useEffect(() => {
    void useAssets.getState().loadPremium(user);
    // My files: list only the root folder up front; subfolders load when the user opens them.
    useUploads.getState().reset(user);
    if (user) void useUploads.getState().openFolder(null);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    loadMap(id)
      .then((doc) => {
        if (cancelled) return;
        if (!doc) return setResult({ id, status: "missing" });
        useEditor.getState().load(doc);
        setResult({ id, status: "ready" });
        // Names / sizes of the images this map uses (layers list, export) - not the whole library.
        void useUploads.getState().ensureInfos(
          doc.elements.flatMap((e) => (e.type === "asset" && e.assetId.startsWith("u:") ? [e.assetId.slice(2)] : [])),
        );
      })
      .catch(() => !cancelled && setResult({ id, status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => () => useEditor.getState().reset(), []);

  if (status !== "ready") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-slate-300">
        <p>{status === "loading" ? t("editor.loadingMap") : status === "missing" ? t("editor.notFound") : t("common.errorGeneric")}</p>
        {status !== "loading" && (
          <Link href="/maps" className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950">
            {t("editor.backToMaps")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-900 text-slate-100">
      <Toolbar onSettings={() => setSettings(true)} onExport={() => setExporting(true)} />
      {saveState === "conflict" && <ConflictBanner id={id} />}
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <EditorCanvas />
        <RightPanel />
      </div>
      <StatusBar />
      <MapSettingsDialog open={settings} onClose={() => setSettings(false)} />
      <ExportDialog open={exporting} onClose={() => setExporting(false)} />
    </div>
  );
}

function ConflictBanner({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 bg-red-900/80 px-4 py-2 text-sm text-red-50">
      <span className="flex-1">{t("editor.conflictTitle")}</span>
      <Button
        className="py-1"
        onClick={async () => {
          const doc = await loadMap(id);
          if (doc) useEditor.getState().load(doc);
        }}
      >
        {t("editor.conflictReload")}
      </Button>
      <Button variant="danger" className="py-1" onClick={() => void flushSave(true)}>
        {t("editor.conflictOverwrite")}
      </Button>
    </div>
  );
}
