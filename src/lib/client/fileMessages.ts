// Human-readable messages for file-manager error codes (server codes + client pre-checks).
import type { TKey } from "@/lib/i18n";
import type { NameError } from "@/lib/fileNames";
import type { SkippedEntry } from "@/lib/types";
import { LIMITS } from "@/lib/limits";
import { formatBytes } from "@/lib/format";
import en from "@/lib/i18n/en";
import { toast } from "./toasts";
import type { UploadReport } from "./uploads";

type T = (key: TKey, vars?: Record<string, string | number>) => string;

const KNOWN = new Set(Object.keys(en.files.errors));

export function fileErrorMessage(t: T, code: string, data: Record<string, unknown> = {}): string {
  if (code === "invalid_name" && typeof data.reason === "string" && data.reason in en.files.nameErrors) {
    return nameErrorMessage(t, data.reason as NameError);
  }
  const key = (KNOWN.has(code) ? `files.errors.${code}` : "files.errors.generic") as TKey;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return t(key, {
    max: num(data.max, code === "too_deep" ? LIMITS.files.maxFolderDepth : LIMITS.files.maxArchiveEntries),
    limit:
      code === "storage_limit"
        ? formatBytes(num(data.limit, LIMITS.user.maxStorageBytes))
        : num(data.limit, code === "folder_limit" ? LIMITS.files.maxFolders : LIMITS.user.maxUploads),
    size: formatBytes(LIMITS.user.maxUploadBytes),
    archive: formatBytes(LIMITS.files.maxArchiveBytes),
    unpacked: formatBytes(LIMITS.files.maxArchiveUnpackedBytes),
    side: LIMITS.files.maxImageSide,
  });
}

export function nameErrorMessage(t: T, e: NameError): string {
  return t(`files.nameErrors.${e}` as TKey, { max: LIMITS.files.maxNameLength });
}

export function skipReason(t: T, r: SkippedEntry["reason"]): string {
  return t(`files.reasons.${r}` as TKey);
}

/** Short toast summary of an upload; details are shown by the file browser. */
export function announceUpload(t: T, report: UploadReport) {
  if (report.uploaded.length || report.folders.length) {
    toast(t("files.result.summary", { files: report.uploaded.length, folders: report.folders.length }), "success");
  }
  for (const f of report.failed.slice(0, 3)) toast(`${f.name}: ${fileErrorMessage(t, f.code, f.data)}`, "error");
  if (report.failed.length > 3) toast(t("files.result.more", { n: report.failed.length - 3 }), "error");
  if (report.skipped.length) toast(t("files.result.skipped", { n: report.skipped.length }), "info");
}
