// "My files": uploaded images and folders of logged-in users (GridFS + folders via the API).
// Loaded lazily, one folder at a time: a folder's listing is fetched the first time it is opened,
// then kept in memory so re-entering it is instant (stale entries are shown at once and refreshed
// in the background). Images themselves are only downloaded by <img loading="lazy"> when shown.
// Guests can't upload. The browser-side checks here only give quick feedback - the server re-validates everything.
"use client";

import { useMemo } from "react";
import { create } from "zustand";
import type { FileSearchResult, FolderInfo, FolderListing, SessionUser, SkippedEntry, StorageUsage, UploadInfo, UploadResult } from "@/lib/types";
import { LIMITS } from "@/lib/limits";
import { fileKind } from "@/lib/fileNames";
import { api, ApiError } from "./api";

export class UploadError extends Error {
  constructor(
    public code: string,
    public fileName: string,
    public data: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export interface UploadReport {
  uploaded: UploadInfo[];
  folders: FolderInfo[];
  skipped: SkippedEntry[];
  failed: { name: string; code: string; data: Record<string, unknown> }[];
}

export interface FolderEntry {
  folder: FolderInfo | null;
  folders: FolderInfo[];
  files: UploadInfo[];
  /** Shown as is, but refreshed from the server the next time the folder is opened. */
  stale: boolean;
}

/** Cache key of a folder: its id, or "root". */
export const folderKey = (id: string | null) => id ?? "root";

interface FilesState {
  /** Owner the cache belongs to - switching accounts clears it. */
  ownerId: string | null;
  entries: Record<string, FolderEntry>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  /** Every folder seen so far (listings, paths, search) - used for breadcrumbs and paths. */
  known: Record<string, FolderInfo>;
  /** Every file seen so far - used by the editor canvas, layers list and export. */
  byId: Record<string, UploadInfo>;
  /** Files referenced by maps that don't exist (any more) - rendered as placeholders. */
  missing: Record<string, true>;
  usage: StorageUsage | null;

  reset: (user: SessionUser | null) => void;
  /** Loads one folder's contents (cached; `force` refetches). Resolves to null on error. */
  openFolder: (id: string | null, force?: boolean) => Promise<FolderEntry | null>;
  search: (q: string) => Promise<FileSearchResult>;
  /** Fetches metadata of the given files if not known yet (e.g. images used by a map). */
  ensureInfos: (ids: string[]) => Promise<void>;
  /** Uploads images and/or archives into `folderId`, one request per file. */
  uploadMany: (user: SessionUser | null, files: File[], folderId: string | null, onProgress?: (done: number, total: number) => void) => Promise<UploadReport>;
  createFolder: (name: string, parentId: string | null) => Promise<FolderInfo>;
  renameFolder: (id: string, name: string) => Promise<void>;
  renameFile: (id: string, name: string) => Promise<void>;
  move: (fileIds: string[], folderIds: string[], targetId: string | null) => Promise<{ moved: number; renamed: { id: string; from: string; to: string }[] }>;
  removeMany: (fileIds: string[], folderIds: string[]) => Promise<void>;
}

let guestCleanupDone = false;
/** Guest uploads used to live in IndexedDB; that storage is gone - free the space once. */
function dropLegacyGuestUploads() {
  if (guestCleanupDone || typeof indexedDB === "undefined") return;
  guestCleanupDone = true;
  try {
    indexedDB.deleteDatabase("mapforge-uploads");
  } catch {
    /* ignore */
  }
}

const HEX_ID = /^[a-f0-9]{24}$/i;

/** Quick client-side check before sending; returns an error code or null. */
export function precheckUpload(file: File): string | null {
  const kind = fileKind(file.name);
  if (file.size === 0) return "empty_file";
  if (kind === "archive") return file.size > LIMITS.files.maxArchiveBytes ? "archive_too_large" : null;
  if (kind === null && !/^image\//.test(file.type)) return "unsupported_type";
  if (file.size > LIMITS.user.maxUploadBytes) return "file_too_large";
  return null;
}

const withFiles = (byId: Record<string, UploadInfo>, files: UploadInfo[]) => {
  if (!files.length) return byId;
  const next = { ...byId };
  for (const f of files) next[f.id] = f;
  return next;
};
const withFolders = (known: Record<string, FolderInfo>, folders: (FolderInfo | null)[]) => {
  const next = { ...known };
  for (const f of folders) if (f) next[f.id] = { ...next[f.id], ...f };
  return next;
};
const markAllStale = (entries: Record<string, FolderEntry>) =>
  Object.fromEntries(Object.entries(entries).map(([k, e]) => [k, { ...e, stale: true }]));

// In-flight folder requests (deduplicated) and a generation counter so responses that arrive
// after an account switch are dropped.
const inflight = new Map<string, Promise<FolderEntry | null>>();
let generation = 0;

export const useUploads = create<FilesState>((set, get) => {
  const patchEntry = (key: string, fn: (e: FolderEntry) => FolderEntry) => {
    const e = get().entries[key];
    if (e) set({ entries: { ...get().entries, [key]: fn(e) } });
  };

  return {
    ownerId: null,
    entries: {},
    loading: {},
    errors: {},
    known: {},
    byId: {},
    missing: {},
    usage: null,

    reset(user) {
      dropLegacyGuestUploads();
      const owner = user?.id ?? null;
      if (owner === get().ownerId) return;
      generation++;
      inflight.clear();
      set({ ownerId: owner, entries: {}, loading: {}, errors: {}, known: {}, byId: {}, missing: {}, usage: null });
    },

    openFolder(id, force = false) {
      const key = folderKey(id);
      const cached = get().entries[key];
      if (!get().ownerId) return Promise.resolve(null);
      if (cached && !cached.stale && !force) return Promise.resolve(cached);
      const running = inflight.get(key);
      if (running) return running;
      const gen = generation;
      set({ loading: { ...get().loading, [key]: true } });
      const p = api<FolderListing>(`/api/uploads?folder=${encodeURIComponent(key)}`)
        .then((r) => {
          if (gen !== generation) return null;
          const entry: FolderEntry = { folder: r.folder, folders: r.folders, files: r.uploads, stale: false };
          const { [key]: _err, ...errors } = get().errors;
          void _err;
          set({
            entries: { ...get().entries, [key]: entry },
            errors,
            known: withFolders(get().known, [...r.path, r.folder, ...r.folders]),
            byId: withFiles(get().byId, r.uploads),
            usage: r.usage,
          });
          return entry;
        })
        .catch((e) => {
          if (gen !== generation) return null;
          set({ errors: { ...get().errors, [key]: e instanceof ApiError ? e.code : "failed" } });
          return null;
        })
        .finally(() => {
          inflight.delete(key);
          if (gen === generation) {
            const { [key]: _l, ...loading } = get().loading;
            void _l;
            set({ loading });
          }
        });
      inflight.set(key, p);
      return p;
    },

    async search(q) {
      const r = await api<FileSearchResult>(`/api/uploads?q=${encodeURIComponent(q.slice(0, 100))}`);
      set({ known: withFolders(get().known, [...r.known, ...r.folders]), byId: withFiles(get().byId, r.uploads) });
      return r;
    },

    async ensureInfos(ids) {
      const need = [...new Set(ids)].filter((id) => HEX_ID.test(id) && !get().byId[id] && !get().missing[id]).slice(0, LIMITS.files.maxBatchItems);
      if (!need.length || !get().ownerId) return;
      try {
        const r = await api<{ uploads: UploadInfo[]; missing: string[] }>("/api/uploads/lookup", { method: "POST", json: { ids: need } });
        const missing = { ...get().missing };
        for (const id of r.missing) missing[id] = true;
        set({ byId: withFiles(get().byId, r.uploads), missing });
      } catch {
        /* images still render from their URL */
      }
    },

    async uploadMany(user, files, folderId, onProgress) {
      const report: UploadReport = { uploaded: [], folders: [], skipped: [], failed: [] };
      if (!user) {
        for (const f of files) report.failed.push({ name: f.name, code: "login_required", data: {} });
        return report;
      }
      const key = folderKey(folderId);
      let done = 0;
      for (const file of files) {
        const pre = precheckUpload(file);
        if (pre) {
          report.failed.push({ name: file.name, code: pre, data: {} });
        } else {
          const fd = new FormData();
          fd.append("file", file, file.name);
          fd.append("folderId", folderId ?? "");
          try {
            const r = await api<UploadResult>("/api/uploads", { method: "POST", body: fd });
            report.uploaded.push(...r.uploads);
            report.folders.push(...r.folders);
            report.skipped.push(...r.skipped.map((s) => (fileKind(file.name) === "archive" ? { ...s, path: `${file.name}/${s.path}` } : s)));
            // Parent counts, merged subfolders etc. changed: everything cached is refreshed on next visit,
            // but the target folder is patched right away so the new items appear instantly.
            const direct = r.uploads.filter((u) => (u.folderId ?? null) === folderId);
            const directFolders = r.folders.filter((f) => (f.parentId ?? null) === folderId).map((f) => ({ ...f, itemCount: undefined }));
            const entries = markAllStale(get().entries);
            if (entries[key]) entries[key] = { ...entries[key], files: [...direct, ...entries[key].files], folders: [...entries[key].folders, ...directFolders] };
            const usage = get().usage;
            set({
              entries,
              known: withFolders(get().known, r.folders),
              byId: withFiles(get().byId, r.uploads),
              usage: usage && {
                files: usage.files + r.uploads.length,
                bytes: usage.bytes + r.uploads.reduce((sum, u) => sum + u.size, 0),
                folders: usage.folders + r.folders.length,
              },
            });
          } catch (e) {
            const code = e instanceof ApiError ? e.code : "failed";
            const data = e instanceof ApiError ? e.data : {};
            report.failed.push({ name: file.name, code, data });
            if (Array.isArray(data.skipped)) {
              report.skipped.push(...(data.skipped as SkippedEntry[]).map((s) => ({ ...s, path: `${file.name}/${s.path}` })));
            }
            if (code === "upload_limit" || code === "storage_limit" || code === "unauthorized") {
              // Remaining files would fail the same way.
              for (const rest of files.slice(done + 1)) report.failed.push({ name: rest.name, code, data });
              break;
            }
          }
        }
        done++;
        onProgress?.(done, files.length);
      }
      return report;
    },

    async createFolder(name, parentId) {
      const r = await api<{ folder: FolderInfo }>("/api/folders", { method: "POST", json: { name, parentId } });
      const folder = { ...r.folder, itemCount: 0 };
      const key = folderKey(parentId);
      // The grandparent's item count changed; the new folder is known to be empty (instant to open).
      const entries = markAllStale(get().entries);
      if (entries[key]) entries[key] = { ...entries[key], folders: [...entries[key].folders, folder], stale: !!get().entries[key]?.stale };
      entries[folder.id] = { folder, folders: [], files: [], stale: false };
      const usage = get().usage;
      set({ entries, known: withFolders(get().known, [folder]), usage: usage && { ...usage, folders: usage.folders + 1 } });
      return folder;
    },

    async renameFolder(id, name) {
      const r = await api<{ folder: FolderInfo }>(`/api/folders/${id}`, { method: "PATCH", json: { name } });
      const prev = get().known[id];
      const folder = { ...prev, ...r.folder };
      patchEntry(folderKey(folder.parentId), (e) => ({ ...e, folders: e.folders.map((f) => (f.id === id ? { ...f, name: folder.name } : f)) }));
      patchEntry(id, (e) => ({ ...e, folder }));
      set({ known: withFolders(get().known, [folder]) });
    },

    async renameFile(id, name) {
      const r = await api<{ upload: UploadInfo }>(`/api/uploads/${id}`, { method: "PATCH", json: { name } });
      patchEntry(folderKey(r.upload.folderId), (e) => ({ ...e, files: e.files.map((f) => (f.id === id ? r.upload : f)) }));
      set({ byId: withFiles(get().byId, [r.upload]) });
    },

    async move(fileIds, folderIds, targetId) {
      const r = await api<{ moved: number; renamed: { id: string; from: string; to: string }[] }>("/api/uploads/move", {
        method: "POST",
        json: { fileIds, folderIds, targetId },
      });
      // Moved items leave their folders at once; every cached folder is refreshed on its next visit.
      const gone = new Set([...fileIds, ...folderIds]);
      const entries = markAllStale(get().entries);
      for (const [k, e] of Object.entries(entries)) {
        entries[k] = { ...e, files: e.files.filter((f) => !gone.has(f.id)), folders: e.folders.filter((f) => !gone.has(f.id)) };
      }
      const known = { ...get().known };
      for (const id of folderIds) if (known[id]) known[id] = { ...known[id], parentId: targetId };
      const byId = { ...get().byId };
      for (const id of fileIds) if (byId[id]) byId[id] = { ...byId[id], folderId: targetId };
      set({ entries, known, byId });
      return r;
    },

    async removeMany(fileIds, folderIds) {
      await api("/api/uploads/delete", { method: "POST", json: { fileIds, folderIds } });
      const gone = new Set([...fileIds, ...folderIds]);
      const entries = markAllStale(get().entries);
      for (const [k, e] of Object.entries(entries)) {
        entries[k] = { ...e, files: e.files.filter((f) => !gone.has(f.id)), folders: e.folders.filter((f) => !gone.has(f.id)) };
      }
      // Cached contents of deleted folders are dropped (their subfolders 404 on the next visit and fall back).
      for (const id of folderIds) delete entries[id];
      const byId = { ...get().byId };
      const missing = { ...get().missing };
      for (const id of fileIds) {
        delete byId[id];
        missing[id] = true;
      }
      set({ entries, byId, missing });
    },
  };
});

/**
 * Upload lookup for the map renderer: known files, `null` for files known to be missing.
 * Files not looked up yet are rendered straight from their URL (see MapRenderer).
 */
export function useUploadMap(): Record<string, { url: string } | null> {
  const byId = useUploads((s) => s.byId);
  const missing = useUploads((s) => s.missing);
  return useMemo(() => {
    const m: Record<string, { url: string } | null> = { ...byId };
    for (const id of Object.keys(missing)) m[id] = null;
    return m;
  }, [byId, missing]);
}

/** Upload of a single image without the report (used by JSON project import). */
export async function uploadOne(user: SessionUser | null, file: File, folderId: string | null): Promise<UploadInfo> {
  const r = await useUploads.getState().uploadMany(user, [file], folderId);
  if (r.uploaded[0]) return r.uploaded[0];
  const f = r.failed[0];
  throw new UploadError(f?.code ?? "failed", file.name, f?.data);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Returns the upload as a data: URL (for export / project files), or null. */
export async function uploadAsDataUrl(id: string): Promise<string | null> {
  // Old guest uploads ("lu_…") no longer exist.
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  try {
    const res = await fetch(`/api/uploads/${id}`, { credentials: "same-origin" });
    if (!res.ok) return null;
    return blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(",");
  const type = head.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}
