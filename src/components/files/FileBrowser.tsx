"use client";

// Folder-based browser for the user's uploaded files. Used in the editor's left panel ("panel")
// and on the /files page ("page"). Contents are loaded lazily, one folder at a time: a folder that
// was never opened shows a skeleton while its listing loads; a folder opened before is shown
// instantly from memory (and quietly refreshed if something changed). Images are fetched by the
// browser only when their tile is on screen. All mutations go through useUploads -> API.
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/client/session";
import { folderKey, useUploads, type UploadReport } from "@/lib/client/uploads";
import { announceUpload, fileErrorMessage, skipReason } from "@/lib/client/fileMessages";
import { ApiError } from "@/lib/client/api";
import { toast } from "@/lib/client/toasts";
import { UPLOAD_ACCEPT } from "@/lib/fileNames";
import { formatBytes } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import type { FileSearchResult, FolderInfo, UploadInfo } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Button, cx } from "@/components/ui/controls";
import { MoveDialog, NameDialog } from "./FileDialogs";

/** Drag payload for moving items inside the browser: JSON { files: string[], folders: string[] }. */
export const MOVE_MIME = "application/x-mapforge-items";

type Key = `d:${string}` | `f:${string}`;
const fKey = (id: string): Key => `f:${id}`;
const dKey = (id: string): Key => `d:${id}`;

type Dialog =
  | { kind: "newFolder" }
  | { kind: "renameFolder"; folder: FolderInfo }
  | { kind: "renameFile"; file: UploadInfo }
  | { kind: "move"; files: string[]; folders: string[] };

const collator = typeof Intl !== "undefined" ? new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }) : null;
const byName = (a: { name: string }, b: { name: string }) => (collator ? collator.compare(a.name, b.name) : a.name.localeCompare(b.name));

/** Ancestors of `id` (top first, `id` included) from the folders known so far. */
export function folderPath(known: Record<string, FolderInfo>, id: string | null): FolderInfo[] {
  const out: FolderInfo[] = [];
  const seen = new Set<string>();
  for (let cur = id; cur && !seen.has(cur); cur = known[cur]?.parentId ?? null) {
    seen.add(cur);
    const f = known[cur];
    if (!f) break;
    out.unshift(f);
  }
  return out;
}

const SEARCH_DELAY = 250;

export default function FileBrowser({
  variant,
  onPick,
  assetMime,
}: {
  variant: "panel" | "page";
  /** Panel: clicking an image adds it to the map. */
  onPick?: (u: UploadInfo) => void;
  /** Panel: MIME type the editor canvas accepts for drops ("u:<id>" lines). */
  assetMime?: string;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const entries = useUploads((s) => s.entries);
  const errors = useUploads((s) => s.errors);
  const known = useUploads((s) => s.known);
  const usage = useUploads((s) => s.usage);
  const store = useUploads.getState;

  const [current, setCurrent] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; r: FileSearchResult } | null>(null);
  const [selection, setSelection] = useState<Set<Key>>(new Set());
  const [anchor, setAnchor] = useState<Key | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<UploadReport | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // folder id, "root" or "here"
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const entry = entries[folderKey(current)];
  const error = errors[folderKey(current)];
  const needsLoad = !entry || entry.stale;
  const q = query.trim();

  // Load the open folder when it isn't cached (skeleton) or is stale (cached content stays visible).
  useEffect(() => {
    if (!user) return;
    store().reset(user); // no-op unless the account changed
    if (needsLoad) void store().openFolder(current);
  }, [user, current, needsLoad, store]);

  // The open folder was deleted (here or in another tab): go up to the nearest folder that exists.
  // (State adjusted during render - React re-renders right away without committing the old state.)
  if (error === "folder_not_found" && current) setCurrent(known[current]?.parentId ?? null);

  // Search runs on the server (names of all folders), debounced.
  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      store()
        .search(q)
        .then((r) => !cancelled && setResults({ q, r }))
        .catch(() => !cancelled && setResults({ q, r: { folders: [], uploads: [], known: [], truncated: false } }));
    }, SEARCH_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, store]);

  const crumbs = useMemo(() => folderPath(known, current), [known, current]);
  const searchResult = q && results?.q === q ? results.r : null;
  const loadingView = q ? !searchResult : !entry;

  const visibleFolders = useMemo(() => [...((q ? searchResult?.folders : entry?.folders) ?? [])].sort(byName), [q, searchResult, entry]);
  const visibleFiles = useMemo(() => [...((q ? searchResult?.uploads : entry?.files) ?? [])].sort(byName), [q, searchResult, entry]);
  const order: Key[] = useMemo(() => [...visibleFolders.map((f) => dKey(f.id)), ...visibleFiles.map((f) => fKey(f.id))], [visibleFolders, visibleFiles]);
  // Selection only ever contains visible items (navigating or deleting drops the rest).
  const selected = useMemo(() => new Set(order.filter((k) => selection.has(k))), [order, selection]);
  const selFiles = [...selected].filter((k) => k.startsWith("f:")).map((k) => k.slice(2));
  const selFolders = [...selected].filter((k) => k.startsWith("d:")).map((k) => k.slice(2));
  const folderById = (id: string) => visibleFolders.find((f) => f.id === id) ?? known[id];

  if (!user) return null;

  // ------------------------------------------------------------ actions

  const open = (id: string | null) => {
    setCurrent(id);
    setQuery("");
    setResults(null);
    setSelection(new Set());
    setAnchor(null);
  };

  const upload = async (list: File[], folderId: string | null) => {
    if (!list.length || progress) return;
    setReport(null);
    setProgress({ done: 0, total: list.length });
    try {
      const r = await store().uploadMany(user, list, folderId, (done, total) => setProgress({ done, total }));
      announceUpload(t, r);
      if (r.skipped.length || r.failed.length) setReport(r);
    } finally {
      setProgress(null);
    }
  };

  const showError = (e: unknown) => toast(e instanceof ApiError ? fileErrorMessage(t, e.code, e.data) : t("files.errors.generic"), "error");

  const doMove = async (fileIds: string[], folderIds: string[], target: string | null) => {
    if (!fileIds.length && !folderIds.length) return;
    try {
      const r = await store().move(fileIds, folderIds, target);
      if (r.moved) toast(t("files.moved", { n: r.moved }), "success");
      if (r.renamed.length) toast(t("files.movedRenamed", { n: r.renamed.length }), "info");
      setSelection(new Set());
      setResults(null);
    } catch (e) {
      showError(e);
    }
  };

  const doDelete = async (fileIds: string[], folderIds: string[]) => {
    if (!fileIds.length && !folderIds.length) return;
    let msg: string;
    if (fileIds.length + folderIds.length > 1) msg = t("files.deleteConfirm", { n: fileIds.length + folderIds.length });
    else if (folderIds.length) msg = t("files.deleteFolderConfirm", { name: folderById(folderIds[0])?.name ?? "" });
    else msg = t("files.deleteFileConfirm", { name: visibleFiles.find((f) => f.id === fileIds[0])?.name ?? "" });
    if (!confirm(msg)) return;
    try {
      await store().removeMany(fileIds, folderIds);
      toast(t("files.deleted", { n: fileIds.length + folderIds.length }), "success");
      setSelection(new Set());
      setResults(null);
    } catch (e) {
      showError(e);
    }
  };

  // ------------------------------------------------------------ selection

  const toggle = (k: Key) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelection(next);
    setAnchor(k);
  };
  const range = (k: Key) => {
    const a = anchor && order.includes(anchor) ? order.indexOf(anchor) : 0;
    const b = order.indexOf(k);
    setSelection(new Set(order.slice(Math.min(a, b), Math.max(a, b) + 1)));
  };
  /** Returns true when the click was a selection gesture. */
  const selectClick = (e: MouseEvent, k: Key) => {
    if (e.shiftKey) {
      range(k);
      return true;
    }
    if (e.ctrlKey || e.metaKey) {
      toggle(k);
      return true;
    }
    return false;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    if (e.key === "Delete" && selected.size) {
      e.preventDefault();
      void doDelete(selFiles, selFolders);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setSelection(new Set(order));
    } else if (e.key === "Escape" && selected.size) {
      e.stopPropagation();
      setSelection(new Set());
    } else if (e.key === "F2" && selected.size === 1) {
      e.preventDefault();
      if (selFolders[0]) setDialog({ kind: "renameFolder", folder: folderById(selFolders[0])! });
      else if (selFiles[0]) setDialog({ kind: "renameFile", file: visibleFiles.find((f) => f.id === selFiles[0])! });
    } else if (e.key === "Backspace" && current && !q) {
      e.preventDefault();
      open(known[current]?.parentId ?? null);
    }
  };

  // ------------------------------------------------------------ drag & drop

  const dragPayload = (k: Key) => {
    const keys = selected.has(k) ? [...selected] : [k];
    return {
      files: keys.filter((x) => x.startsWith("f:")).map((x) => x.slice(2)),
      folders: keys.filter((x) => x.startsWith("d:")).map((x) => x.slice(2)),
    };
  };
  const onItemDragStart = (e: DragEvent, k: Key) => {
    const p = dragPayload(k);
    e.dataTransfer.setData(MOVE_MIME, JSON.stringify(p));
    if (assetMime && p.files.length) e.dataTransfer.setData(assetMime, p.files.map((id) => `u:${id}`).join("\n"));
    e.dataTransfer.effectAllowed = "copyMove";
  };
  const canDrop = (e: DragEvent) => e.dataTransfer.types.includes(MOVE_MIME) || e.dataTransfer.types.includes("Files");
  const dropOn = (target: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (!canDrop(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes(MOVE_MIME) ? "move" : "copy";
      setDropTarget(target ?? "root");
    },
    onDragLeave: () => setDropTarget((d) => (d === (target ?? "root") ? null : d)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      dragDepth.current = 0;
      const raw = e.dataTransfer.getData(MOVE_MIME);
      if (raw) {
        try {
          const p = JSON.parse(raw) as { files?: unknown; folders?: unknown };
          const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
          const fl = ids(p.folders);
          // Dropping a folder onto itself is a no-op (moving into a subfolder is refused by the server).
          if (target && fl.includes(target)) return;
          void doMove(ids(p.files), fl, target);
        } catch {
          /* foreign payload */
        }
        return;
      }
      const list = Array.from(e.dataTransfer.files ?? []);
      if (list.length) void upload(list, target);
    },
  });

  // ------------------------------------------------------------ render

  const isPanel = variant === "panel";
  const dropHere = dropOn(current);
  const pathLabel = (folderId: string | null) => [t("files.root"), ...folderPath(known, folderId).map((f) => f.name)].join(" / ");

  const checkbox = (k: Key) => (
    <span
      role="checkbox"
      aria-checked={selected.has(k)}
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        if (e.shiftKey) range(k);
        else toggle(k);
      }}
      className={cx(
        "absolute left-1 top-1 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border text-slate-950",
        selected.has(k) ? "border-amber-400 bg-amber-400" : "border-slate-500 bg-slate-900/80 opacity-0 group-hover:opacity-100",
        selected.size > 0 && "opacity-100",
      )}
    >
      {selected.has(k) && <Icon name="check" size={13} />}
    </span>
  );

  const folderTile = (f: FolderInfo) => {
    const k = dKey(f.id);
    const d = dropOn(f.id);
    return (
      <div
        key={k}
        data-testid="folder-item"
        draggable
        onDragStart={(e) => onItemDragStart(e, k)}
        {...d}
        onClick={(e) => {
          if (!selectClick(e, k)) open(f.id);
        }}
        className={cx(
          "group relative flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800 p-2 pl-7 ring-1 transition",
          selected.has(k) ? "ring-amber-400" : "ring-slate-700 hover:ring-amber-500",
          dropTarget === f.id && "bg-amber-500/20 ring-2 ring-amber-400",
        )}
        title={f.name}
      >
        {checkbox(k)}
        <Icon name="folder" size={isPanel ? 20 : 26} className="shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-slate-100">{f.name}</div>
          {q ? (
            <div className="truncate text-[10px] text-slate-500">{pathLabel(f.parentId)}</div>
          ) : (
            typeof f.itemCount === "number" && <div className="text-[10px] text-slate-500">{t("files.count", { n: f.itemCount })}</div>
          )}
        </div>
        <ItemActions
          onRename={() => setDialog({ kind: "renameFolder", folder: f })}
          onDelete={() => void doDelete([], [f.id])}
          renameLabel={t("files.rename")}
          deleteLabel={t("files.delete")}
        />
      </div>
    );
  };

  const fileTile = (u: UploadInfo) => {
    const k = fKey(u.id);
    return (
      <div
        key={k}
        data-testid="file-item"
        draggable
        onDragStart={(e) => onItemDragStart(e, k)}
        onClick={(e) => {
          if (selectClick(e, k)) return;
          if (onPick) onPick(u);
          else {
            setSelection(selected.size === 1 && selected.has(k) ? new Set() : new Set([k]));
            setAnchor(k);
          }
        }}
        className={cx(
          "group relative cursor-pointer rounded-lg bg-slate-800 p-1.5 ring-1 transition",
          selected.has(k) ? "ring-2 ring-amber-400" : "ring-slate-700 hover:ring-amber-500",
        )}
        title={`${u.name}\n${t("files.details", { w: u.width, h: u.height, size: formatBytes(u.size) })}`}
      >
        {checkbox(k)}
        <Thumb key={u.url} url={u.url} name={u.name} />
        <span className="mt-1 line-clamp-1 block break-all text-[11px] text-slate-200">{u.name}</span>
        {q ? (
          <span className="line-clamp-1 block text-[10px] text-slate-500">{pathLabel(u.folderId)}</span>
        ) : (
          !isPanel && <span className="block text-[10px] text-slate-500">{t("files.details", { w: u.width, h: u.height, size: formatBytes(u.size) })}</span>
        )}
        <ItemActions
          onRename={() => setDialog({ kind: "renameFile", file: u })}
          onDelete={() => void doDelete([u.id], [])}
          renameLabel={t("files.rename")}
          deleteLabel={t("files.delete")}
          floating
        />
      </div>
    );
  };

  const filesPct = usage ? Math.min(100, (usage.files / LIMITS.user.maxUploads) * 100) : 0;
  const bytesPct = usage ? Math.min(100, (usage.bytes / LIMITS.user.maxStorageBytes) * 100) : 0;
  const folderGrid = isPanel ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]";
  const fileGrid = isPanel ? "grid-cols-2" : "grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]";

  return (
    <div
      className={cx("relative flex flex-col gap-3 outline-none", !isPanel && "min-h-[60vh]")}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="file-browser"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) dragDepth.current++;
      }}
      onDragLeave={(e) => {
        if (e.dataTransfer.types.includes("Files") && --dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDropTarget(null);
        }
      }}
      onDragOver={(e) => {
        // OS files dropped anywhere in the browser go to the open folder.
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropTarget("here");
      }}
      onDrop={dropHere.onDrop}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = "";
          void upload(list, current);
        }}
      />

      {/* toolbar */}
      <div className={cx("flex flex-wrap items-center gap-2", isPanel && "gap-1.5")}>
        <Button variant="primary" className={cx(isPanel && "flex-1")} onClick={() => input.current?.click()} disabled={!!progress} data-testid="upload-btn">
          <Icon name="upload" size={16} /> {progress ? t("files.uploading", progress) : t("files.upload")}
        </Button>
        <Button onClick={() => setDialog({ kind: "newFolder" })} title={t("files.newFolder")} data-testid="new-folder-btn">
          <Icon name="folderPlus" size={16} /> {!isPanel && t("files.newFolder")}
        </Button>
        {!isPanel && <div className="flex-1" />}
        <label className={cx("flex items-center gap-2 rounded-md bg-slate-800 px-2 ring-1 ring-slate-700 focus-within:ring-amber-500", isPanel ? "w-full" : "w-72")}>
          <Icon name="search" size={15} className="text-slate-500" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelection(new Set());
            }}
            placeholder={t("files.search")}
            className="w-full bg-transparent py-1.5 text-sm text-slate-100 outline-none"
            maxLength={100}
            data-testid="file-search"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-white" aria-label={t("common.close")}>
              <Icon name="x" size={14} />
            </button>
          )}
        </label>
      </div>
      <p className="text-[11px] leading-snug text-slate-500">
        {t("files.uploadHint", { size: formatBytes(LIMITS.user.maxUploadBytes), archive: formatBytes(LIMITS.files.maxArchiveBytes) })}
      </p>

      {/* usage */}
      <div className={cx("grid gap-2 text-[11px] text-slate-400", isPanel ? "grid-cols-2" : "max-w-md grid-cols-2")} data-testid="file-usage">
        <div>
          {usage ? t("files.usageFiles", { used: usage.files, max: LIMITS.user.maxUploads }) : " "}
          <div className="mt-1 h-1 rounded bg-slate-800">
            <div className={cx("h-1 rounded", filesPct > 90 ? "bg-red-500" : "bg-amber-500")} style={{ width: `${filesPct}%` }} />
          </div>
        </div>
        <div>
          {usage ? t("files.usageStorage", { used: formatBytes(usage.bytes), max: formatBytes(LIMITS.user.maxStorageBytes) }) : " "}
          <div className="mt-1 h-1 rounded bg-slate-800">
            <div className={cx("h-1 rounded", bytesPct > 90 ? "bg-red-500" : "bg-amber-500")} style={{ width: `${bytesPct}%` }} />
          </div>
        </div>
      </div>

      {/* breadcrumbs */}
      {!q && (
        <nav className="flex flex-wrap items-center gap-0.5 text-sm" aria-label="breadcrumb" data-testid="breadcrumbs">
          {current && (
            <button
              onClick={() => open(known[current]?.parentId ?? null)}
              title={t("files.up")}
              className="mr-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Icon name="arrowLeft" size={15} />
            </button>
          )}
          {[null, ...crumbs.map((c) => c.id)].map((id, i) => {
            const d = dropOn(id);
            const last = i === crumbs.length;
            return (
              <span key={id ?? "root"} className="flex items-center">
                {i > 0 && <Icon name="chevronRight" size={13} className="text-slate-600" />}
                <button
                  onClick={() => open(id)}
                  {...d}
                  className={cx(
                    "max-w-[10rem] truncate rounded px-1.5 py-0.5",
                    last ? "font-semibold text-amber-400" : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    dropTarget === (id ?? "root") && "bg-amber-500/30 ring-1 ring-amber-400",
                  )}
                >
                  {id ? known[id]?.name : t("files.root")}
                </button>
              </span>
            );
          })}
          {entry?.stale && <span className="ml-2 h-2 w-2 animate-pulse rounded-full bg-amber-400/70" title={t("common.loading")} data-testid="revalidating" />}
        </nav>
      )}

      {/* selection bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100 ring-1 ring-amber-500/40" data-testid="selection-bar">
          <span className="mr-auto font-semibold">{t("files.selected", { n: selected.size })}</span>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setDialog({ kind: "move", files: selFiles, folders: selFolders })} data-testid="move-btn">
            <Icon name="folderMove" size={14} /> {t("files.move")}
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-xs text-red-300" onClick={() => void doDelete(selFiles, selFolders)} data-testid="delete-btn">
            <Icon name="trash" size={14} /> {!isPanel && t("files.delete")}
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setSelection(new Set())} title={t("files.clearSelection")}>
            <Icon name="x" size={14} />
          </Button>
        </div>
      )}

      {/* upload report */}
      {report && (
        <div className="rounded-lg bg-slate-800 p-3 text-xs ring-1 ring-slate-700" data-testid="upload-report">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex-1 font-semibold text-slate-100">
              {t("files.result.summary", { files: report.uploaded.length, folders: report.folders.length })}
            </span>
            <button onClick={() => setReport(null)} className="text-slate-400 hover:text-white" aria-label={t("files.result.dismiss")}>
              <Icon name="x" size={14} />
            </button>
          </div>
          {report.failed.length > 0 && (
            <ReportList
              title={t("files.result.failed", { n: report.failed.length })}
              rows={report.failed.map((f) => [f.name, fileErrorMessage(t, f.code, f.data)])}
              more={(n) => t("files.result.more", { n })}
              tone="text-red-300"
            />
          )}
          {report.skipped.length > 0 && (
            <ReportList
              title={t("files.result.skipped", { n: report.skipped.length })}
              rows={report.skipped.map((s) => [s.path, skipReason(t, s.reason)])}
              more={(n) => t("files.result.more", { n })}
              tone="text-amber-200"
            />
          )}
        </div>
      )}

      {/* items */}
      <div className={cx("relative min-h-24 rounded-lg transition", dropTarget === "here" && "bg-amber-500/10 outline-dashed outline-2 outline-amber-400")}>
        {loadingView && error && !q ? (
          <div className="rounded-lg border border-red-500/40 bg-red-900/20 p-4 text-center text-sm text-red-200" data-testid="files-error">
            {fileErrorMessage(t, error)}
            <div className="mt-2">
              <Button className="py-1 text-xs" onClick={() => void store().openFolder(current, true)}>
                {t("files.retry")}
              </Button>
            </div>
          </div>
        ) : loadingView ? (
          <Skeleton folderGrid={folderGrid} fileGrid={fileGrid} files={isPanel ? 4 : 10} />
        ) : !visibleFolders.length && !visibleFiles.length ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            <Icon name="archive" size={28} className="mx-auto mb-2 text-slate-600" />
            {q ? t("files.noResults") : t("files.empty")}
            <div className="mt-1 text-xs">{t("files.dropHere")}</div>
          </div>
        ) : (
          <div className="space-y-2" data-testid="file-items">
            {visibleFolders.length > 0 && <div className={cx("grid gap-2", folderGrid)}>{visibleFolders.map(folderTile)}</div>}
            {visibleFiles.length > 0 && <div className={cx("grid gap-2", fileGrid)}>{visibleFiles.map(fileTile)}</div>}
            {searchResult?.truncated && <p className="text-[11px] text-slate-500">{t("files.searchTruncated")}</p>}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-500">{isPanel ? t("files.panelHint") : t("files.pageHint")}</p>

      {dialog?.kind === "newFolder" && (
        <NameDialog
          title={t("files.newFolder")}
          label={t("files.folderName")}
          initial=""
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            await store().createFolder(name, current);
          }}
        />
      )}
      {dialog?.kind === "renameFolder" && (
        <NameDialog
          title={t("files.rename")}
          label={t("files.folderName")}
          initial={dialog.folder.name}
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            await store().renameFolder(dialog.folder.id, name);
            setResults(null);
          }}
        />
      )}
      {dialog?.kind === "renameFile" && (
        <NameDialog
          title={t("files.rename")}
          label={t("files.fileName")}
          initial={dialog.file.name}
          selectBase
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            await store().renameFile(dialog.file.id, name);
            setResults(null);
          }}
        />
      )}
      {dialog?.kind === "move" && (
        <MoveDialog
          movingFolders={dialog.folders}
          count={dialog.files.length + dialog.folders.length}
          initial={current}
          onClose={() => setDialog(null)}
          onMove={async (target) => {
            setDialog(null);
            await doMove(dialog.files, dialog.folders, target);
          }}
        />
      )}
    </div>
  );
}

/** Image tile that shows a pulsing placeholder until the (lazily loaded) image has arrived. */
function Thumb({ url, name }: { url: string; name: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded bg-[repeating-conic-gradient(#334155_0_25%,#1e293b_0_50%)] bg-[length:16px_16px]">
      {state !== "ok" && (
        <div
          className={cx("absolute inset-0 flex items-center justify-center", state === "loading" ? "animate-pulse bg-slate-700" : "bg-slate-900 text-slate-600")}
          data-testid={state === "loading" ? "thumb-loading" : "thumb-error"}
        >
          {state === "error" && <Icon name="image" size={22} />}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setState("ok")}
        onError={() => setState("error")}
        className={cx("h-full w-full object-contain transition-opacity duration-200", state === "ok" ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}

/** Placeholder shown while a folder that was never opened is being listed. */
function Skeleton({ folderGrid, fileGrid, files }: { folderGrid: string; fileGrid: string; files: number }) {
  return (
    <div className="space-y-2" data-testid="files-skeleton" aria-busy="true">
      <div className={cx("grid gap-2", folderGrid)}>
        {[0, 1].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-2 rounded-lg bg-slate-800 p-2 ring-1 ring-slate-700">
            <div className="h-6 w-6 rounded bg-slate-700" />
            <div className="h-3 flex-1 rounded bg-slate-700" />
          </div>
        ))}
      </div>
      <div className={cx("grid gap-2", fileGrid)}>
        {Array.from({ length: files }, (_, i) => (
          <div key={i} className="animate-pulse rounded-lg bg-slate-800 p-1.5 ring-1 ring-slate-700">
            <div className="aspect-square w-full rounded bg-slate-700" />
            <div className="mt-1.5 h-2.5 w-3/4 rounded bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemActions({
  onRename,
  onDelete,
  renameLabel,
  deleteLabel,
  floating,
}: {
  onRename: () => void;
  onDelete: () => void;
  renameLabel: string;
  deleteLabel: string;
  floating?: boolean;
}) {
  return (
    <div className={cx("hidden gap-0.5 group-hover:flex", floating && "absolute right-1 top-1 z-10")}>
      <button
        title={renameLabel}
        aria-label={renameLabel}
        onClick={(e) => {
          e.stopPropagation();
          onRename();
        }}
        className="rounded bg-slate-700 p-1 text-slate-100 hover:bg-slate-600"
      >
        <Icon name="pencil" size={12} />
      </button>
      <button
        title={deleteLabel}
        aria-label={deleteLabel}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded bg-red-600 p-1 text-white hover:bg-red-500"
      >
        <Icon name="trash" size={12} />
      </button>
    </div>
  );
}

function ReportList({ title, rows, more, tone }: { title: string; rows: [string, string][]; more: (n: number) => string; tone: string }) {
  const MAX = 30;
  return (
    <div className="mt-2">
      <div className={cx("font-semibold", tone)}>{title}</div>
      <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
        {rows.slice(0, MAX).map(([a, b], i) => (
          <li key={i} className="flex gap-2">
            <span className="min-w-0 flex-1 truncate text-slate-300" title={a}>
              {a}
            </span>
            <span className="shrink-0 text-slate-500">{b}</span>
          </li>
        ))}
      </ul>
      {rows.length > MAX && <div className="text-slate-500">{more(rows.length - MAX)}</div>}
    </div>
  );
}
