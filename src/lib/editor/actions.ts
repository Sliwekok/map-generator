"use client";

import type { SessionUser } from "@/lib/types";
import { useUploads, type UploadReport } from "@/lib/client/uploads";
import { announceUpload } from "@/lib/client/fileMessages";
import { fileKind } from "@/lib/fileNames";
import { toast } from "@/lib/client/toasts";
import type { TKey } from "@/lib/i18n";
import { useEditor } from "./store";
import { uploadElement } from "./factory";
import type { Pt } from "./geometry";

export { formatBytes } from "@/lib/format";
export { announceUpload };

type T = (key: TKey, vars?: Record<string, string | number>) => string;

/**
 * Uploads files into `folderId` and (optionally) places the uploaded images on the map at `at`.
 * Archives are extracted into folders but their images are not placed.
 */
export async function uploadFiles(files: File[], user: SessionUser | null, t: T, at?: Pt | null, folderId: string | null = null): Promise<UploadReport> {
  const total: UploadReport = { uploaded: [], folders: [], skipped: [], failed: [] };
  if (!user) {
    toast(t("files.errors.login_required"), "error");
    return total;
  }
  let offset = 0;
  for (const file of files) {
    const r = await useUploads.getState().uploadMany(user, [file], folderId);
    total.uploaded.push(...r.uploaded);
    total.folders.push(...r.folders);
    total.skipped.push(...r.skipped);
    total.failed.push(...r.failed);
    if (at && fileKind(file.name) !== "archive") {
      const { doc, snap, addElements } = useEditor.getState();
      for (const info of r.uploaded) {
        if (!doc) break;
        addElements([uploadElement(info, { x: at.x + offset, y: at.y + offset }, doc, snap)]);
        offset += (doc.grid.size || 70) / 2;
      }
    }
    if (r.failed.some((f) => f.code === "upload_limit" || f.code === "storage_limit")) {
      for (const rest of files.slice(files.indexOf(file) + 1)) total.failed.push({ name: rest.name, code: r.failed[0].code, data: r.failed[0].data });
      break;
    }
  }
  announceUpload(t, total);
  return total;
}
