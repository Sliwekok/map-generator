"use client";

import type { SessionUser } from "@/lib/types";
import { LIMITS } from "@/lib/limits";
import { useUploads, UploadError } from "@/lib/client/uploads";
import { toast } from "@/lib/client/toasts";
import type { TKey } from "@/lib/i18n";
import { useEditor } from "./store";
import { uploadElement } from "./factory";
import type { Pt } from "./geometry";

type T = (key: TKey, vars?: Record<string, string | number>) => string;

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round((n / 1024 / 1024) * 10) / 10} MB`;
  return `${Math.round(n / 1024)} KB`;
}

/** Uploads files and (optionally) places them on the map at `at`. */
export async function uploadFiles(files: File[], user: SessionUser | null, t: T, at?: Pt | null) {
  const maxBytes = (user ? LIMITS.user : LIMITS.anonymous).maxUploadBytes;
  const maxCount = (user ? LIMITS.user : LIMITS.anonymous).maxUploads;
  let offset = 0;
  for (const file of files) {
    try {
      const info = await useUploads.getState().upload(user, file);
      if (at) {
        const { doc, snap, addElements } = useEditor.getState();
        if (doc) {
          const g = doc.grid.size || 70;
          addElements([uploadElement(info, { x: at.x + offset, y: at.y + offset }, doc, snap)]);
          offset += g / 2;
        }
      }
    } catch (e) {
      if (e instanceof UploadError) {
        const vars = { name: e.fileName, size: formatBytes(maxBytes), max: maxCount };
        const key: TKey =
          e.code === "tooLarge"
            ? "editor.uploads.tooLarge"
            : e.code === "badType"
              ? "editor.uploads.badType"
              : e.code === "limit"
                ? "editor.uploads.limit"
                : "editor.uploads.failed";
        toast(t(key, vars), "error");
        if (e.code === "limit") return;
      } else {
        toast(t("editor.uploads.failed", { name: file.name }), "error");
      }
    }
  }
}
