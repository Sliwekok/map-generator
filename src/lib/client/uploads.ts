// "My files": uploaded images and folders of logged-in users (GridFS + folders via the API).
// Guests can't upload. The browser-side checks here only give quick feedback - the server re-validates everything.
"use client";

import { create } from "zustand";
import type { FolderInfo, SessionUser, SkippedEntry, StorageUsage, UploadInfo, UploadResult } from "@/lib/types";
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

interface FilesState {
  folders: FolderInfo[];
  files: UploadInfo[];
  byId: Record<string, UploadInfo>;
  usage: StorageUsage;
  loaded: boolean;
  /** Owner the data was loaded for - avoids showing one account's files to the next. */
  ownerId: string | null;
  load: (user: SessionUser | null) => Promise<void>;
  /** Uploads images and/or archives into `folderId`, one request per file. */
  uploadMany: (user: SessionUser | null, files: File[], folderId: string | null, onProgress?: (done: number, total: number) => void) => Promise<UploadReport>;
  createFolder: (name: string, parentId: string | null) => Promise<FolderInfo>;
  renameFolder: (id: string, name: string) => Promise<void>;
  renameFile: (id: string, name: string) => Promise<void>;
  move: (fileIds: string[], folderIds: string[], targetId: string | null) => Promise<{ moved: number; renamed: { id: string; from: string; to: string }[] }>;
  removeMany: (fileIds: string[], folderIds: string[]) => Promise<void>;
}

const EMPTY_USAGE: StorageUsage = { files: 0, bytes: 0, folders: 0 };

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

function indexFiles(files: UploadInfo[]) {
  const byId: Record<string, UploadInfo> = {};
  for (const u of files) byId[u.id] = u;
  return byId;
}

type TreeResponse = { folders: FolderInfo[]; uploads: UploadInfo[]; usage: StorageUsage };

/** Quick client-side check before sending; returns an error code or null. */
export function precheckUpload(file: File): string | null {
  const kind = fileKind(file.name);
  if (file.size === 0) return "empty_file";
  if (kind === "archive") return file.size > LIMITS.files.maxArchiveBytes ? "archive_too_large" : null;
  if (kind === null && !/^image\//.test(file.type)) return "unsupported_type";
  if (file.size > LIMITS.user.maxUploadBytes) return "file_too_large";
  return null;
}

export const useUploads = create<FilesState>((set, get) => {
  const refresh = async () => {
    const r = await api<TreeResponse>("/api/uploads");
    set({ folders: r.folders, files: r.uploads, byId: indexFiles(r.uploads), usage: r.usage, loaded: true });
  };

  return {
    folders: [],
    files: [],
    byId: {},
    usage: EMPTY_USAGE,
    loaded: false,
    ownerId: null,

    async load(user) {
      dropLegacyGuestUploads();
      if (!user) {
        set({ folders: [], files: [], byId: {}, usage: EMPTY_USAGE, loaded: true, ownerId: null });
        return;
      }
      if (get().ownerId !== user.id) set({ folders: [], files: [], byId: {}, usage: EMPTY_USAGE, loaded: false, ownerId: user.id });
      await refresh().catch(() => set({ loaded: true }));
    },

    async uploadMany(user, files, folderId, onProgress) {
      const report: UploadReport = { uploaded: [], folders: [], skipped: [], failed: [] };
      if (!user) {
        for (const f of files) report.failed.push({ name: f.name, code: "login_required", data: {} });
        return report;
      }
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
            const all = [...r.uploads, ...get().files];
            set({
              files: all,
              byId: indexFiles(all),
              folders: [...get().folders, ...r.folders],
              usage: {
                files: get().usage.files + r.uploads.length,
                bytes: get().usage.bytes + r.uploads.reduce((s, u) => s + u.size, 0),
                folders: get().usage.folders + r.folders.length,
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
      set({ folders: [...get().folders, r.folder], usage: { ...get().usage, folders: get().usage.folders + 1 } });
      return r.folder;
    },

    async renameFolder(id, name) {
      const r = await api<{ folder: FolderInfo }>(`/api/folders/${id}`, { method: "PATCH", json: { name } });
      set({ folders: get().folders.map((f) => (f.id === id ? r.folder : f)) });
    },

    async renameFile(id, name) {
      const r = await api<{ upload: UploadInfo }>(`/api/uploads/${id}`, { method: "PATCH", json: { name } });
      const files = get().files.map((f) => (f.id === id ? r.upload : f));
      set({ files, byId: indexFiles(files) });
    },

    async move(fileIds, folderIds, targetId) {
      try {
        return await api<{ moved: number; renamed: { id: string; from: string; to: string }[] }>("/api/uploads/move", {
          method: "POST",
          json: { fileIds, folderIds, targetId },
        });
      } finally {
        await refresh().catch(() => undefined);
      }
    },

    async removeMany(fileIds, folderIds) {
      try {
        await api("/api/uploads/delete", { method: "POST", json: { fileIds, folderIds } });
      } finally {
        await refresh().catch(() => undefined);
      }
    },
  };
});

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
