"use client";

import { useEffect } from "react";
import { saveMap } from "@/lib/client/repo";
import { requestRename } from "./itemLabel";
import { useEditor } from "./store";
import { useBrush } from "./brushStore";

const DEBOUNCE_MS = 700;
const MAX_WAIT_MS = 3000;
const RETRY_MS = 5000;

let inflight: Promise<void> | null = null;

/** Saves the current map if it has unsaved changes. Safe to call often. */
export async function flushSave(force = false): Promise<void> {
  if (inflight) {
    await inflight;
    if (!force && useEditor.getState().version === useEditor.getState().savedVersion) return;
  }
  const s = useEditor.getState();
  if (!s.mapId || !s.doc) return;
  if (!force && (s.version === s.savedVersion || s.saveState === "conflict")) return;
  const { mapId, doc, version, revision } = s;
  s.setSaveState("saving");
  inflight = (async () => {
    try {
      const r = await saveMap(mapId, revision, doc, force);
      const now = useEditor.getState();
      if (now.mapId !== mapId) return;
      if (r.ok) now.markSaved(version, r.revision);
      else now.setSaveState("conflict");
    } catch {
      useEditor.getState().setSaveState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
    }
  })();
  await inflight;
  inflight = null;
}

/**
 * Autosave: every content change is persisted ~0.7 s after the user stops editing,
 * and at least every 3 s during continuous editing. Failed saves are retried.
 */
export function useAutosave() {
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let maxWait: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (debounce) clearTimeout(debounce);
      if (maxWait) clearTimeout(maxWait);
      debounce = maxWait = null;
      // Don't save in the middle of a drag - wait for the gesture to end.
      if (useEditor.getState().gestureBase) {
        debounce = setTimeout(run, 300);
        return;
      }
      await flushSave();
      const s = useEditor.getState();
      if (s.saveState === "error" || s.saveState === "offline") {
        if (retry) clearTimeout(retry);
        retry = setTimeout(run, RETRY_MS);
      } else if (s.version !== s.savedVersion && s.saveState !== "conflict") {
        debounce = setTimeout(run, DEBOUNCE_MS);
      }
    };

    const unsub = useEditor.subscribe((s, prev) => {
      if (s.version === prev.version || s.mapId !== prev.mapId) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(run, DEBOUNCE_MS);
      if (!maxWait) maxWait = setTimeout(run, MAX_WAIT_MS);
    });

    const onHide = () => {
      if (document.visibilityState === "hidden") void flushSave();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useEditor.getState();
      if (s.mapId && s.version !== s.savedVersion) {
        void flushSave();
        e.preventDefault();
      }
    };
    const onOnline = () => void run();

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    return () => {
      unsub();
      [debounce, maxWait, retry].forEach((x) => x && clearTimeout(x));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
      void flushSave();
    };
  }, []);
}

function isTyping() {
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
}

/** Global keyboard shortcuts for the editor. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const s = useEditor.getState();
      if (!s.doc) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const g = s.doc.grid.size || 10;

      if (mod) {
        if (k === "z" && !e.shiftKey) s.undo();
        else if ((k === "z" && e.shiftKey) || k === "y") s.redo();
        else if (k === "c") s.copy();
        else if (k === "x") {
          s.copy();
          s.deleteSelection();
        } else if (k === "v") s.paste();
        else if (k === "d") s.duplicateSelection();
        else if (k === "a") s.selectAll();
        else if (k === "s") void flushSave(true);
        else if (k === "0") window.dispatchEvent(new Event("mapforge:fit"));
        else return;
        e.preventDefault();
        return;
      }

      switch (e.key) {
        case "F2":
          if (s.selection.length === 1) {
            e.preventDefault();
            requestRename(s.selection[0]);
          }
          break;
        case "Delete":
        case "Backspace":
          s.deleteSelection();
          break;
        case "Escape":
          s.select([]);
          s.setTool("select");
          break;
        case "ArrowLeft":
          s.nudge(e.shiftKey ? -g : -1, 0);
          break;
        case "ArrowRight":
          s.nudge(e.shiftKey ? g : 1, 0);
          break;
        case "ArrowUp":
          s.nudge(0, e.shiftKey ? -g : -1);
          break;
        case "ArrowDown":
          s.nudge(0, e.shiftKey ? g : 1);
          break;
        case "[":
          if (s.tool === "brush" || s.tool === "eraser") useBrush.getState().grow(1 / 1.2, s.tool === "eraser");
          else s.scaleSelection(1 / 1.1);
          break;
        case "]":
          if (s.tool === "brush" || s.tool === "eraser") useBrush.getState().grow(1.2, s.tool === "eraser");
          else s.scaleSelection(1.1);
          break;
        case "PageUp":
          s.reorder("forward");
          break;
        case "PageDown":
          s.reorder("backward");
          break;
        case "Home":
          s.reorder("back");
          break;
        case "End":
          s.reorder("front");
          break;
        case "+":
        case "=":
          zoomCenter(1.2);
          break;
        case "-":
          zoomCenter(1 / 1.2);
          break;
        case "0":
          window.dispatchEvent(new Event("mapforge:fit"));
          break;
        case "1":
          zoomTo(1);
          break;
        default:
          switch (k) {
            case "v": s.setTool("select"); break;
            case "h": s.setTool("pan"); break;
            case "t": s.setTool("text"); break;
            case "r": s.setTool("rect"); break;
            case "o": s.setTool("ellipse"); break;
            case "p": s.setTool("pen"); break;
            case "b": s.setTool("brush"); break;
            case "x": s.setTool("eraser"); break;
            case "m": s.setTool("measure"); break;
            case "g": s.setShowGrid(!s.showGrid); break;
            case "s": s.setSnap(!s.snap); break;
            case "q": s.rotateSelection(e.shiftKey ? -90 : -15); break;
            case "e": s.rotateSelection(e.shiftKey ? 90 : 15); break;
            case "l":
              s.updateElements(s.selection, (el) => ({ ...el, locked: el.locked ? undefined : true }));
              break;
            default:
              return;
          }
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function canvasSize() {
  const el = document.querySelector('[data-testid="editor-canvas"]');
  return { w: el?.clientWidth ?? 800, h: el?.clientHeight ?? 600 };
}

export function zoomCenter(factor: number) {
  const { w, h } = canvasSize();
  useEditor.getState().zoomAt(factor, { x: w / 2, y: h / 2 });
}

export function zoomTo(zoom: number) {
  const v = useEditor.getState().view;
  zoomCenter(zoom / v.zoom);
}
