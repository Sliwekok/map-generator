// Custom image uploads: IndexedDB for guests, GridFS (via API) for logged-in users.
"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import type { SessionUser, UploadInfo } from "@/lib/types";
import { ALLOWED_UPLOAD_TYPES, LIMITS } from "@/lib/limits";
import { sanitizeSvg, sniffImageType, svgSize } from "@/lib/uploadCheck";
import { api, ApiError } from "./api";
import { localDb } from "./localDb";

export const isLocalUploadId = (id: string) => id.startsWith("lu_");

export class UploadError extends Error {
  constructor(public code: "tooLarge" | "badType" | "limit" | "failed", public fileName: string) {
    super(code);
  }
}

const objectUrls = new Map<string, string>();

function localUrl(id: string, blob: Blob) {
  let u = objectUrls.get(id);
  if (!u) {
    u = URL.createObjectURL(blob);
    objectUrls.set(id, u);
  }
  return u;
}

interface UploadsState {
  byId: Record<string, UploadInfo>;
  local: UploadInfo[];
  cloud: UploadInfo[];
  loaded: boolean;
  load: (user: SessionUser | null) => Promise<void>;
  upload: (user: SessionUser | null, file: File) => Promise<UploadInfo>;
  remove: (user: SessionUser | null, id: string) => Promise<void>;
}

async function imageSize(file: Blob, type: string, text?: string): Promise<{ width: number; height: number }> {
  if (type === "image/svg+xml" && text) {
    const s = svgSize(text);
    if (s) return s;
  }
  try {
    const bmp = await createImageBitmap(file);
    const r = { width: bmp.width, height: bmp.height };
    bmp.close();
    return r;
  } catch {
    return await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        resolve({ width: img.naturalWidth || 256, height: img.naturalHeight || 256 });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => resolve({ width: 256, height: 256 });
      img.src = url;
    });
  }
}

function index(local: UploadInfo[], cloud: UploadInfo[]) {
  const byId: Record<string, UploadInfo> = {};
  for (const u of [...local, ...cloud]) byId[u.id] = u;
  return byId;
}

export const useUploads = create<UploadsState>((set, get) => ({
  byId: {},
  local: [],
  cloud: [],
  loaded: false,

  async load(user) {
    const localRows = await localDb.listUploads().catch(() => []);
    const local: UploadInfo[] = localRows.map((u) => ({
      id: u.id,
      name: u.name,
      contentType: u.contentType,
      width: u.width,
      height: u.height,
      size: u.size,
      source: "local",
      url: localUrl(u.id, u.blob),
    }));
    let cloud: UploadInfo[] = [];
    if (user) {
      cloud = await api<{ uploads: UploadInfo[] }>("/api/uploads")
        .then((r) => r.uploads)
        .catch(() => []);
    }
    set({ local, cloud, byId: index(local, cloud), loaded: true });
  },

  async upload(user, file) {
    const limits = user ? LIMITS.user : LIMITS.anonymous;
    if (file.size > limits.maxUploadBytes) throw new UploadError("tooLarge", file.name);
    let bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type || !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(type)) throw new UploadError("badType", file.name);
    let text: string | undefined;
    let blob: Blob = file;
    if (type === "image/svg+xml") {
      text = sanitizeSvg(new TextDecoder().decode(bytes));
      bytes = new TextEncoder().encode(text);
      blob = new Blob([bytes], { type });
    }
    const { width, height } = await imageSize(blob, type, text);

    if (user) {
      if (get().cloud.length >= limits.maxUploads) throw new UploadError("limit", file.name);
      const fd = new FormData();
      fd.append("file", blob, file.name);
      fd.append("width", String(Math.round(width)));
      fd.append("height", String(Math.round(height)));
      try {
        const r = await api<{ upload: UploadInfo }>("/api/uploads", { method: "POST", body: fd });
        const cloud = [r.upload, ...get().cloud];
        set({ cloud, byId: index(get().local, cloud) });
        return r.upload;
      } catch (e) {
        if (e instanceof ApiError && e.code === "upload_limit") throw new UploadError("limit", file.name);
        if (e instanceof ApiError && e.code === "file_too_large") throw new UploadError("tooLarge", file.name);
        if (e instanceof ApiError && e.code === "unsupported_type") throw new UploadError("badType", file.name);
        throw new UploadError("failed", file.name);
      }
    }

    if (get().local.length >= limits.maxUploads) throw new UploadError("limit", file.name);
    const id = `lu_${nanoid(12)}`;
    const row = {
      id,
      name: file.name.slice(0, 120),
      contentType: type,
      width: Math.round(width),
      height: Math.round(height),
      size: blob.size,
      blob,
      createdAt: new Date().toISOString(),
    };
    try {
      await localDb.putUpload(row);
    } catch {
      throw new UploadError("failed", file.name);
    }
    const info: UploadInfo = { ...row, source: "local", url: localUrl(id, blob) };
    delete (info as Partial<typeof row>).blob;
    const local = [info, ...get().local];
    set({ local, byId: index(local, get().cloud) });
    return info;
  },

  async remove(user, id) {
    if (isLocalUploadId(id)) {
      await localDb.deleteUpload(id);
      const u = objectUrls.get(id);
      if (u) URL.revokeObjectURL(u);
      objectUrls.delete(id);
    } else if (user) {
      await api(`/api/uploads/${id}`, { method: "DELETE" });
    }
    const local = get().local.filter((u) => u.id !== id);
    const cloud = get().cloud.filter((u) => u.id !== id);
    set({ local, cloud, byId: index(local, cloud) });
  },
}));

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
  if (isLocalUploadId(id)) {
    const row = await localDb.getUpload(id);
    return row ? blobToDataUrl(row.blob) : null;
  }
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
