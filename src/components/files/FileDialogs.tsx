"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/client/api";
import { fileErrorMessage, nameErrorMessage } from "@/lib/client/fileMessages";
import { splitExt, validateName } from "@/lib/fileNames";
import { LIMITS } from "@/lib/limits";
import type { FolderInfo } from "@/lib/types";
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

/** Folder tree picker. Folders being moved (and everything below them) can't be chosen. */
export function MoveDialog({
  folders,
  movingFolders,
  count,
  initial,
  onMove,
  onClose,
}: {
  folders: FolderInfo[];
  movingFolders: string[];
  count: number;
  initial: string | null;
  onMove: (target: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const children = useMemo(() => {
    const m = new Map<string | null, FolderInfo[]>();
    for (const f of folders) {
      const k = f.parentId ?? null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    return m;
  }, [folders]);
  const blocked = useMemo(() => {
    const out = new Set(movingFolders);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders) {
        if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
          out.add(f.id);
          grew = true;
        }
      }
    }
    return out;
  }, [folders, movingFolders]);

  const node = (id: string | null, name: string, depth: number) => {
    const disabled = id !== null && blocked.has(id);
    const kids = children.get(id) ?? [];
    return (
      <li key={id ?? "root"}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setTarget(id)}
          data-testid="move-target"
          className={cx(
            "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm",
            target === id ? "bg-amber-500 font-semibold text-slate-950" : "text-slate-200 hover:bg-slate-700",
            disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
          )}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <Icon name={id ? "folder" : "cloud"} size={15} />
          <span className="truncate">{name}</span>
          {id === initial && <span className="ml-auto text-[10px] opacity-60">●</span>}
        </button>
        {kids.length > 0 && !disabled && <ul>{kids.map((k) => node(k.id, k.name, depth + 1))}</ul>}
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
