"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/client/api";
import { fileErrorMessage, nameErrorMessage } from "@/lib/client/fileMessages";
import { splitExt, validateName } from "@/lib/fileNames";
import { LIMITS } from "@/lib/limits";
import { folderKey, useUploads } from "@/lib/client/uploads";
import { Button, cx, Modal } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";

/** Asks for a file / folder name with live validation (same rules as the server). */
export function NameDialog({
  title,
  label,
  initial,
  selectBase,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  initial: string;
  /** Pre-select the name without its extension (renaming files). */
  selectBase?: boolean;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const v = validateName(value);
  const localError = !v.ok && (touched || value !== initial) ? nameErrorMessage(t, v.error) : null;
  const error = localError ?? serverError;

  const submit = async () => {
    setTouched(true);
    if (!v.ok || busy) return;
    if (v.name === initial) return onClose();
    setBusy(true);
    setServerError(null);
    try {
      await onSubmit(v.name);
      onClose();
    } catch (e) {
      setServerError(e instanceof ApiError ? fileErrorMessage(t, e.code, e.data) : t("files.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <label className="block text-sm text-slate-300">
          {label}
          <input
            autoFocus
            data-testid="name-input"
            value={value}
            maxLength={LIMITS.files.maxNameLength + 20}
            onFocus={(e) => {
              const [base] = splitExt(e.target.value);
              if (selectBase && base) e.target.setSelectionRange(0, base.length);
              else e.target.select();
            }}
            onChange={(e) => {
              setValue(e.target.value);
              setServerError(null);
            }}
            aria-invalid={!!error}
            className={cx(
              "mt-1 w-full rounded-md bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-1",
              error ? "ring-red-500" : "ring-slate-700 focus:ring-amber-500",
            )}
          />
        </label>
        <p className="min-h-5 text-sm text-red-300" role="alert" data-testid="name-error">
          {error}
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" type="submit" disabled={busy || !v.ok} data-testid="name-submit">
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Folder tree picker, loaded lazily: the root is listed first and a folder's subfolders are
 * fetched when it is expanded (cached folders expand instantly). Folders being moved can't be
 * chosen and aren't expandable, so nothing below them can be picked either.
 */
export function MoveDialog({
  movingFolders,
  count,
  initial,
  onMove,
  onClose,
}: {
  movingFolders: string[];
  count: number;
  initial: string | null;
  onMove: (target: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const entries = useUploads((s) => s.entries);
  const loading = useUploads((s) => s.loading);
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const blocked = useMemo(() => new Set(movingFolders), [movingFolders]);

  useEffect(() => {
    for (const key of expanded) {
      const e = useUploads.getState().entries[key];
      if (!e || e.stale) void useUploads.getState().openFolder(key === "root" ? null : key);
    }
  }, [expanded]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const node = (id: string | null, name: string, depth: number) => {
    const key = folderKey(id);
    const disabled = id !== null && blocked.has(id);
    const isOpen = expanded.has(key) && !disabled;
    const entry = entries[key];
    const kids = [...(entry?.folders ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    const leaf = entry && !entry.folders.length;
    return (
      <li key={key}>
        <div className="flex items-center" style={{ paddingLeft: depth * 16 }}>
          <button
            type="button"
            onClick={() => toggle(key)}
            disabled={disabled || leaf}
            aria-label={isOpen ? "collapse" : "expand"}
            className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-700", (disabled || leaf) && "invisible")}
          >
            <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={14} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTarget(id)}
            onDoubleClick={() => !disabled && toggle(key)}
            data-testid="move-target"
            className={cx(
              "flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm",
              target === id ? "bg-amber-500 font-semibold text-slate-950" : "text-slate-200 hover:bg-slate-700",
              disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
          >
            <Icon name={id ? "folder" : "cloud"} size={15} />
            <span className="truncate">{name}</span>
            {id === initial && <span className="ml-auto text-[10px] opacity-60">●</span>}
          </button>
        </div>
        {isOpen &&
          (entry ? (
            kids.length > 0 && <ul>{kids.map((k) => node(k.id, k.name, depth + 1))}</ul>
          ) : (
            <div className="space-y-1 py-1" style={{ paddingLeft: (depth + 1) * 16 + 24 }} data-testid="move-tree-loading" aria-busy={!!loading[key]}>
              <div className="h-4 w-32 animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-24 animate-pulse rounded bg-slate-700" />
            </div>
          ))}
      </li>
    );
  };

  return (
    <Modal open onClose={onClose} title={t("files.moveTitle", { n: count })}>
      <ul className="max-h-[50vh] overflow-y-auto rounded-lg bg-slate-900 p-2 ring-1 ring-slate-700" data-testid="move-tree">
        {node(null, t("files.root"), 0)}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" disabled={target === undefined} onClick={() => target !== undefined && void onMove(target)} data-testid="move-confirm">
          {t("files.moveHere")}
        </Button>
      </div>
    </Modal>
  );
}
