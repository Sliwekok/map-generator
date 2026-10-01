"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "@/lib/editor/store";
import { aabb } from "@/lib/editor/geometry";
import { snapBox } from "@/lib/editor/factory";
import { useI18n, type TKey } from "@/lib/i18n";
import { LAYER_ORDER, type LayerId, type MapContent, type MapElement } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/controls";
import type { Pt } from "@/lib/editor/geometry";
import { requestRename, useItemLabel } from "@/lib/editor/itemLabel";

export interface ContextMenuState {
  /** Viewport (client) coordinates where the menu opens. */
  x: number;
  y: number;
  /** Map coordinates of the click (used by "Paste here"). */
  world: Pt;
}

export type MenuItem = Item;
type Item =
  | { kind: "sep" }
  | { kind: "label"; text: string }
  | {
      kind: "action";
      label: string;
      icon?: string;
      hint?: string;
      danger?: boolean;
      checked?: boolean;
      disabled?: boolean;
      run?: () => void;
      sub?: Item[];
    };

const MENU_W = 232;

function isEditable(doc: MapContent, el: MapElement) {
  const layer = doc.layers.find((l) => l.id === el.layer);
  return !el.locked && !layer?.locked;
}

/** Right-click menu for the editor canvas: acts on the current selection, or on the map when nothing is selected. */
export default function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const { t } = useI18n();
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const clipboard = useEditor((s) => s.clipboard);
  const showGrid = useEditor((s) => s.showGrid);
  const snap = useEditor((s) => s.snap);
  const labelOf = useItemLabel();

  const items = useMemo<Item[]>(() => {
    const s = useEditor.getState;
    if (!doc) return [];
    const ids = new Set(selection);
    const els = doc.elements.filter((e) => ids.has(e.id));
    const pasteItem: Item = {
      kind: "action",
      label: t("editor.ctx.pasteHere"),
      icon: "paste",
      hint: "Ctrl+V",
      disabled: !clipboard.length,
      run: () => s().paste(menu.world),
    };

    if (!els.length) {
      return [
        pasteItem,
        { kind: "action", label: t("editor.ctx.selectAll"), icon: "select", hint: "Ctrl+A", run: () => s().selectAll() },
        { kind: "sep" },
        { kind: "action", label: t("editor.ctx.fit"), icon: "fit", hint: "0", run: () => window.dispatchEvent(new Event("mapforge:fit")) },
        { kind: "action", label: t("editor.ctx.showGrid"), icon: "grid", hint: "G", checked: showGrid, run: () => s().setShowGrid(!showGrid) },
        { kind: "action", label: t("editor.ctx.snap"), icon: "magnet", hint: "S", checked: snap, run: () => s().setSnap(!snap) },
      ];
    }

    const editable = els.filter((e) => isEditable(doc, e));
    const editIds = editable.map((e) => e.id);
    const noEdit = !editable.length;
    const allLocked = els.every((e) => e.locked);
    const layerLocked = els.some((e) => doc.layers.find((l) => l.id === e.layer)?.locked);
    const sameLayer = els.every((e) => e.layer === els[0].layer) ? els[0].layer : null;
    const single = els.length === 1 ? els[0] : null;
    const upd = (fn: (e: MapElement) => MapElement) => s().updateElements(editIds, fn);

    const moveToLayer = (layer: LayerId) => {
      upd((e) => ({ ...e, layer }));
      // Items moved to a hidden or locked layer can't stay selected.
      const target = doc.layers.find((l) => l.id === layer);
      if (target && (!target.visible || target.locked)) s().select(selection.filter((id) => !editIds.includes(id)));
    };

    const out: Item[] = [];
    out.push({
      kind: "label",
      text: single ? shorten(labelOf(single).name) : t("editor.props.selected", { n: els.length }),
    });
    if (noEdit) out.push({ kind: "label", text: t(layerLocked && !allLocked ? "editor.ctx.layerLocked" : "editor.ctx.locked") });

    out.push(
      {
        kind: "action",
        label: t("editor.ctx.cut"),
        icon: "cut",
        hint: "Ctrl+X",
        disabled: noEdit,
        run: () => {
          s().copy();
          s().deleteSelection();
        },
      },
      { kind: "action", label: t("editor.ctx.copy"), icon: "copy", hint: "Ctrl+C", run: () => s().copy() },
      pasteItem,
      { kind: "action", label: t("common.duplicate"), icon: "duplicate", hint: "Ctrl+D", run: () => s().duplicateSelection() },
      { kind: "sep" },
    );

    if (single) {
      out.push({
        kind: "action",
        label: t("editor.ctx.rename"),
        icon: "pencil",
        hint: "F2",
        run: () => requestRename(single.id),
      });
    }
    if (single?.type === "text") {
      out.push({
        kind: "action",
        label: t("editor.ctx.editText"),
        icon: "text",
        disabled: noEdit,
        run: () => s().setEditingText(single.id),
      });
    }

    out.push(
      {
        kind: "action",
        label: t("editor.ctx.layer"),
        icon: "layers",
        disabled: noEdit,
        sub: [...LAYER_ORDER].reverse().map((l) => {
          const ls = doc.layers.find((x) => x.id === l);
          return {
            kind: "action" as const,
            label: t(`editor.layers.${l}` as TKey),
            checked: sameLayer === l,
            icon: ls?.locked ? "lock" : !ls?.visible ? "eyeOff" : undefined,
            run: () => moveToLayer(l),
          };
        }),
      },
      {
        kind: "action",
        label: t("editor.props.arrange"),
        icon: "front",
        sub: [
          { kind: "action", label: t("editor.ctx.toFront"), icon: "front", hint: "End", run: () => s().reorder("front") },
          { kind: "action", label: t("editor.ctx.forward"), icon: "up", hint: "PgUp", run: () => s().reorder("forward") },
          { kind: "action", label: t("editor.ctx.backward"), icon: "down", hint: "PgDn", run: () => s().reorder("backward") },
          { kind: "action", label: t("editor.ctx.toBack"), icon: "back", hint: "Home", run: () => s().reorder("back") },
        ],
      },
      {
        kind: "action",
        label: t("editor.ctx.transform"),
        icon: "rotR",
        disabled: noEdit,
        sub: [
          { kind: "action", label: t("editor.ctx.rotL"), icon: "rotL", hint: "Shift+Q", run: () => s().rotateSelection(-90) },
          { kind: "action", label: t("editor.ctx.rotR"), icon: "rotR", hint: "Shift+E", run: () => s().rotateSelection(90) },
          { kind: "sep" },
          { kind: "action", label: t("editor.props.flipH"), icon: "flipH", run: () => upd((e) => ({ ...e, flipX: !e.flipX || undefined })) },
          { kind: "action", label: t("editor.props.flipV"), icon: "flipV", run: () => upd((e) => ({ ...e, flipY: !e.flipY || undefined })) },
          { kind: "sep" },
          { kind: "action", label: t("editor.ctx.grow"), icon: "scaleUp", hint: "]", run: () => s().scaleSelection(1.1) },
          { kind: "action", label: t("editor.ctx.shrink"), icon: "scaleDown", hint: "[", run: () => s().scaleSelection(1 / 1.1) },
          {
            kind: "action",
            label: t("editor.props.snapToGrid"),
            icon: "grid",
            disabled: !doc.grid.size,
            run: () =>
              upd((e) => {
                const b = aabb(e);
                const p = snapBox(b, doc.grid.size);
                return { ...e, x: e.x + (p.x - b.x), y: e.y + (p.y - b.y) };
              }),
          },
        ],
      },
      { kind: "sep" },
      {
        kind: "action",
        label: allLocked ? t("editor.props.unlock") : t("editor.props.lock"),
        icon: allLocked ? "unlock" : "lock",
        hint: "L",
        run: () => s().updateElements(selection, (e) => ({ ...e, locked: allLocked ? undefined : true })),
      },
      {
        kind: "action",
        label: t("editor.ctx.selectLayer"),
        icon: "list",
        disabled: !sameLayer,
        run: () => {
          if (!sameLayer) return;
          const ls = doc.layers.find((l) => l.id === sameLayer);
          if (ls?.locked || !ls?.visible) return;
          s().select(doc.elements.filter((e) => e.layer === sameLayer && !e.locked).map((e) => e.id));
        },
      },
      { kind: "sep" },
      { kind: "action", label: t("common.delete"), icon: "trash", hint: "Del", danger: true, disabled: noEdit, run: () => s().deleteSelection() },
    );
    return out;
  }, [doc, selection, clipboard, showGrid, snap, menu.world, t, labelOf]);

  if (!doc) return null;
  return <PopupMenu items={items} x={menu.x} y={menu.y} onClose={onClose} testId="context-menu" />;
}

/** A menu at viewport coordinates (rendered in a portal) that closes itself on outside click, Escape, scroll, resize or blur. */
export function PopupMenu({ items, x, y, onClose, testId }: { items: Item[]; x: number; y: number; onClose: () => void; testId?: string }) {
  // Close on outside click, Escape, scroll/zoom, resize or window blur.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-ctx-menu]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!(e.target as Element).closest?.("[data-ctx-menu]")) onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: true });
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(<MenuList items={items} x={x} y={y} onClose={onClose} autoFocus testId={testId} />, document.body);
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

const shorten = (s: string) => (s.length > 28 ? `${s.slice(0, 27)}…` : s);

function MenuList({
  items,
  x,
  y,
  onClose,
  autoFocus,
  parentWidth,
  testId,
  onBack,
}: {
  items: Item[];
  x: number;
  y: number;
  onClose: () => void;
  autoFocus?: boolean;
  /** For submenus: width of the parent row, used to flip to the left side when there's no room on the right. */
  parentWidth?: number;
  testId?: string;
  onBack?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });
  const [openSub, setOpenSub] = useState<number | null>(null);
  const [subAnchor, setSubAnchor] = useState<{ x: number; y: number; w: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + width > vw - 4) left = parentWidth !== undefined ? x - parentWidth - width : vw - width - 4;
    if (top + height > vh - 4) top = Math.max(4, vh - height - 4);
    setPos({ left: Math.max(4, left), top: Math.max(4, top), ready: true });
  }, [x, y, parentWidth, items.length]);

  useEffect(() => {
    if (autoFocus && pos.ready) ref.current?.focus();
  }, [autoFocus, pos.ready]);

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(":scope > [role^=menuitem]:not([disabled])") ?? []);

  const openSubAt = (i: number, row: HTMLElement) => {
    const r = row.getBoundingClientRect();
    setSubAnchor({ x: r.right - 2, y: r.top - 5, w: r.width - 4 });
    setOpenSub(i);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = focusables();
    const idx = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (!list.length) return;
      const next = e.key === "ArrowDown" ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
      list[next].focus();
    } else if (e.key === "ArrowRight") {
      const btn = document.activeElement as HTMLElement;
      const i = Number(btn?.dataset.idx);
      if (btn?.dataset.sub && !Number.isNaN(i)) {
        e.preventDefault();
        e.stopPropagation();
        openSubAt(i, btn);
      }
    } else if (e.key === "ArrowLeft" && onBack) {
      e.preventDefault();
      e.stopPropagation();
      onBack();
    }
  };

  return (
    <div
      ref={ref}
      data-ctx-menu
      data-testid={testId}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      // React portals bubble synthetic events to the canvas; keep them from starting canvas gestures.
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="fixed z-50 rounded-lg border border-slate-700 bg-slate-900 py-1 text-sm text-slate-200 shadow-2xl shadow-black/50 outline-none"
      style={{ left: pos.left, top: pos.top, width: MENU_W, visibility: pos.ready ? "visible" : "hidden" }}
    >
      {items.map((it, i) => {
        if (it.kind === "sep") return <div key={i} className="my-1 h-px bg-slate-700/80" />;
        if (it.kind === "label")
          return (
            <div key={i} className="truncate px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {it.text}
            </div>
          );
        const hasSub = !!it.sub;
        const isOpen = openSub === i;
        return (
          <button
            key={i}
            type="button"
            role={it.checked !== undefined ? "menuitemcheckbox" : "menuitem"}
            data-idx={i}
            data-sub={hasSub ? "1" : undefined}
            aria-haspopup={hasSub || undefined}
            aria-expanded={hasSub ? isOpen : undefined}
            aria-checked={it.checked}
            disabled={it.disabled}
            onPointerEnter={(e) => {
              if (hoverTimer.current) clearTimeout(hoverTimer.current);
              const row = e.currentTarget;
              if (it.disabled) return;
              if (hasSub) hoverTimer.current = setTimeout(() => openSubAt(i, row), 120);
              else hoverTimer.current = setTimeout(() => setOpenSub(null), 200);
            }}
            onClick={(e) => {
              if (it.disabled) return;
              if (hasSub) {
                openSubAt(i, e.currentTarget);
                return;
              }
              it.run?.();
              onClose();
            }}
            className={cx(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-left outline-none",
              it.disabled
                ? "cursor-default text-slate-600"
                : it.danger
                  ? "text-red-300 hover:bg-red-500/20 focus:bg-red-500/20"
                  : "hover:bg-slate-700/70 focus:bg-slate-700/70",
              isOpen && "bg-slate-700/70",
            )}
          >
            <span className="flex w-4 shrink-0 justify-center">
              {it.checked ? (
                <Icon name="check" size={15} className="text-amber-400" />
              ) : it.icon ? (
                <Icon name={it.icon} size={15} className={it.disabled ? "" : it.danger ? "text-red-400" : "text-slate-400"} />
              ) : null}
            </span>
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.checked && it.icon && <Icon name={it.icon} size={13} className="text-slate-500" />}
            {it.hint && <span className="text-[11px] text-slate-500">{it.hint}</span>}
            {hasSub && <Icon name="chevronRight" size={14} className="text-slate-500" />}
          </button>
        );
      })}
      {openSub !== null && subAnchor && items[openSub]?.kind === "action" && (
        <MenuList
          key={openSub}
          items={(items[openSub] as Extract<Item, { kind: "action" }>).sub ?? []}
          x={subAnchor.x}
          y={subAnchor.y}
          parentWidth={subAnchor.w}
          onClose={onClose}
          autoFocus
          onBack={() => {
            const i = openSub;
            setOpenSub(null);
            requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-idx="${i}"]`)?.focus());
          }}
        />
      )}
    </div>
  );
}
