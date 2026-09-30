"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { LayerId, MapContent, MapDoc, MapElement, TextElement } from "@/lib/types";
import {
  aabb,
  center,
  normAngle,
  rotateElementAround,
  scaleElement,
  translateElement,
  unionBox,
  type Pt,
} from "./geometry";
import { relayoutText } from "./text";
import { contentOf } from "@/lib/client/repo";

export type Tool = "select" | "pan" | "text" | "rect" | "ellipse" | "pen" | "brush" | "eraser" | "measure";
export type SaveState = "saved" | "saving" | "pending" | "error" | "offline" | "conflict";

export interface View {
  zoom: number;
  x: number; // screen offset of map origin
  y: number;
}

const HISTORY_LIMIT = 150;
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

export const newId = () => nanoid(10);

interface EditorState {
  mapId: string | null;
  source: MapDoc["source"] | null;
  revision: number;
  doc: MapContent | null;

  selection: string[];
  tool: Tool;
  view: View;
  showGrid: boolean;
  snap: boolean;
  editingTextId: string | null;

  past: MapContent[];
  future: MapContent[];
  gestureBase: MapContent | null;
  clipboard: MapElement[];

  version: number; // increments on every content change
  savedVersion: number;
  saveState: SaveState;

  // --- lifecycle
  load: (doc: MapDoc) => void;
  reset: () => void;

  // --- content
  setDoc: (updater: (d: MapContent) => MapContent, opts?: { history?: boolean }) => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;

  addElements: (els: MapElement[], select?: boolean) => void;
  updateElements: (ids: string[], fn: (el: MapElement) => MapElement, opts?: { history?: boolean }) => void;
  deleteSelection: () => void;
  deleteElements: (ids: string[]) => void;
  duplicateSelection: () => void;
  copy: () => void;
  paste: (at?: Pt) => void;
  reorder: (kind: "front" | "forward" | "backward" | "back") => void;
  scaleSelection: (factor: number) => void;
  rotateSelection: (deg: number) => void;
  nudge: (dx: number, dy: number) => void;
  align: (kind: "left" | "centerH" | "right" | "top" | "middle" | "bottom" | "distH" | "distV") => void;
  setLayerFlag: (id: LayerId, flag: "visible" | "locked", value: boolean) => void;
  resizePage: (w: number, h: number, mode: "canvas" | "scale", anchor: [number, number]) => void;

  // --- selection / ui
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  setTool: (t: Tool) => void;
  setView: (v: Partial<View>) => void;
  zoomAt: (factor: number, screen: Pt) => void;
  fit: (vw: number, vh: number) => void;
  setShowGrid: (v: boolean) => void;
  setSnap: (v: boolean) => void;
  setEditingText: (id: string | null) => void;

  // --- saving
  markSaved: (version: number, revision: number) => void;
  setSaveState: (s: SaveState) => void;
  setRevision: (r: number) => void;
}

const initial = {
  mapId: null,
  source: null,
  revision: 0,
  doc: null,
  selection: [] as string[],
  tool: "select" as Tool,
  view: { zoom: 1, x: 0, y: 0 },
  showGrid: true,
  snap: true,
  editingTextId: null,
  past: [] as MapContent[],
  future: [] as MapContent[],
  gestureBase: null,
  clipboard: [] as MapElement[],
  version: 0,
  savedVersion: 0,
  saveState: "saved" as SaveState,
};

function isEditable(doc: MapContent, el: MapElement) {
  const layer = doc.layers.find((l) => l.id === el.layer);
  return !el.locked && !layer?.locked;
}

export const useEditor = create<EditorState>((set, get) => {
  /** Applies a content change and records history (unless inside a gesture). */
  const commit = (next: MapContent, history = true) => {
    const s = get();
    if (!s.doc || next === s.doc) return;
    const patch: Partial<EditorState> = { doc: next, version: s.version + 1, saveState: "pending" };
    if (history && !s.gestureBase) {
      patch.past = [...s.past, s.doc].slice(-HISTORY_LIMIT);
      patch.future = [];
    }
    set(patch);
  };

  const selected = () => {
    const { doc, selection } = get();
    if (!doc) return [];
    const ids = new Set(selection);
    return doc.elements.filter((e) => ids.has(e.id));
  };

  const mapSelected = (fn: (el: MapElement) => MapElement, onlyEditable = true) => {
    const { doc, selection } = get();
    if (!doc || !selection.length) return;
    const ids = new Set(selection);
    commit({
      ...doc,
      elements: doc.elements.map((e) => (ids.has(e.id) && (!onlyEditable || isEditable(doc, e)) ? fn(e) : e)),
    });
  };

  return {
    ...initial,

    load(doc) {
      set({
        ...initial,
        mapId: doc.id,
        source: doc.source,
        revision: doc.revision,
        doc: contentOf(doc),
        showGrid: doc.grid.enabled,
        snap: doc.grid.enabled,
      });
    },
    reset() {
      set({ ...initial });
    },

    setDoc(updater, opts) {
      const d = get().doc;
      if (!d) return;
      commit(updater(d), opts?.history !== false);
    },

    beginGesture() {
      set({ gestureBase: get().doc });
    },
    endGesture() {
      const { gestureBase, doc, past } = get();
      if (gestureBase && doc && gestureBase !== doc) {
        set({ past: [...past, gestureBase].slice(-HISTORY_LIMIT), future: [], gestureBase: null });
      } else {
        set({ gestureBase: null });
      }
    },

    undo() {
      const { past, doc, future, version } = get();
      if (!past.length || !doc) return;
      const prev = past[past.length - 1];
      const ids = new Set(prev.elements.map((e) => e.id));
      set({
        doc: prev,
        past: past.slice(0, -1),
        future: [doc, ...future].slice(0, HISTORY_LIMIT),
        version: version + 1,
        saveState: "pending",
        selection: get().selection.filter((id) => ids.has(id)),
      });
    },
    redo() {
      const { past, doc, future, version } = get();
      if (!future.length || !doc) return;
      const next = future[0];
      const ids = new Set(next.elements.map((e) => e.id));
      set({
        doc: next,
        past: [...past, doc].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        version: version + 1,
        saveState: "pending",
        selection: get().selection.filter((id) => ids.has(id)),
      });
    },

    addElements(els, select = true) {
      const doc = get().doc;
      if (!doc || !els.length) return;
      commit({ ...doc, elements: [...doc.elements, ...els] });
      if (select) set({ selection: els.map((e) => e.id) });
    },

    updateElements(ids, fn, opts) {
      const doc = get().doc;
      if (!doc) return;
      const set_ = new Set(ids);
      commit(
        { ...doc, elements: doc.elements.map((e) => (set_.has(e.id) ? fn(e) : e)) },
        opts?.history !== false,
      );
    },

    deleteSelection() {
      const { doc, selection } = get();
      if (!doc || !selection.length) return;
      const ids = new Set(selection);
      commit({ ...doc, elements: doc.elements.filter((e) => !ids.has(e.id) || !isEditable(doc, e)) });
      set({ selection: [] });
    },

    deleteElements(ids) {
      const { doc, selection } = get();
      if (!doc || !ids.length) return;
      const del = new Set(doc.elements.filter((e) => ids.includes(e.id) && isEditable(doc, e)).map((e) => e.id));
      if (!del.size) return;
      commit({ ...doc, elements: doc.elements.filter((e) => !del.has(e.id)) });
      set({ selection: selection.filter((id) => !del.has(id)) });
    },

    duplicateSelection() {
      const doc = get().doc;
      const els = selected();
      if (!doc || !els.length) return;
      const off = doc.grid.size || 20;
      const copies = els.map((e) => ({ ...translateElement(e, off, off), id: newId(), locked: undefined }));
      get().addElements(copies);
    },

    copy() {
      set({ clipboard: selected().map((e) => ({ ...e })) });
    },
    paste(at) {
      const { clipboard, doc } = get();
      if (!doc || !clipboard.length) return;
      const box = unionBox(clipboard.map(aabb))!;
      let dx = doc.grid.size || 20;
      let dy = dx;
      if (at) {
        dx = at.x - (box.x + box.width / 2);
        dy = at.y - (box.y + box.height / 2);
      }
      const copies = clipboard.map((e) => ({ ...translateElement(e, dx, dy), id: newId(), locked: undefined }));
      get().addElements(copies);
      // next paste goes further
      if (!at) set({ clipboard: clipboard.map((e) => translateElement(e, dx, dy)) });
    },

    reorder(kind) {
      const { doc, selection } = get();
      if (!doc || !selection.length) return;
      const ids = new Set(selection);
      let els = [...doc.elements];
      if (kind === "front") els = [...els.filter((e) => !ids.has(e.id)), ...els.filter((e) => ids.has(e.id))];
      else if (kind === "back") els = [...els.filter((e) => ids.has(e.id)), ...els.filter((e) => !ids.has(e.id))];
      else if (kind === "forward") {
        for (let i = els.length - 2; i >= 0; i--) {
          if (ids.has(els[i].id) && !ids.has(els[i + 1].id)) [els[i], els[i + 1]] = [els[i + 1], els[i]];
        }
      } else {
        for (let i = 1; i < els.length; i++) {
          if (ids.has(els[i].id) && !ids.has(els[i - 1].id)) [els[i], els[i - 1]] = [els[i - 1], els[i]];
        }
      }
      commit({ ...doc, elements: els });
    },

    scaleSelection(factor) {
      const els = selected();
      const box = unionBox(els.map(aabb));
      if (!box || factor <= 0) return;
      const pivot = center(box);
      mapSelected((e) => scaleElement(e, factor, factor, pivot));
    },

    rotateSelection(deg) {
      const els = selected();
      const box = unionBox(els.map(aabb));
      if (!box) return;
      if (els.length === 1) {
        mapSelected((e) => ({ ...e, rotation: normAngle(e.rotation + deg) }));
      } else {
        const pivot = center(box);
        mapSelected((e) => rotateElementAround(e, pivot, deg));
      }
    },

    nudge(dx, dy) {
      mapSelected((e) => translateElement(e, dx, dy));
    },

    align(kind) {
      const doc = get().doc;
      const els = selected().filter((e) => doc && isEditable(doc, e));
      if (els.length < 2) return;
      const boxes = new Map(els.map((e) => [e.id, aabb(e)]));
      const all = unionBox([...boxes.values()])!;
      const moves = new Map<string, [number, number]>();
      if (kind === "distH" || kind === "distV") {
        const horiz = kind === "distH";
        const sorted = [...els].sort((a, b) => (horiz ? boxes.get(a.id)!.x - boxes.get(b.id)!.x : boxes.get(a.id)!.y - boxes.get(b.id)!.y));
        const total = sorted.reduce((s, e) => s + (horiz ? boxes.get(e.id)!.width : boxes.get(e.id)!.height), 0);
        const gap = ((horiz ? all.width : all.height) - total) / (sorted.length - 1);
        let cur = horiz ? all.x : all.y;
        for (const e of sorted) {
          const b = boxes.get(e.id)!;
          moves.set(e.id, horiz ? [cur - b.x, 0] : [0, cur - b.y]);
          cur += (horiz ? b.width : b.height) + gap;
        }
      } else {
        for (const e of els) {
          const b = boxes.get(e.id)!;
          const m: [number, number] = [0, 0];
          if (kind === "left") m[0] = all.x - b.x;
          if (kind === "right") m[0] = all.x + all.width - (b.x + b.width);
          if (kind === "centerH") m[0] = all.x + all.width / 2 - (b.x + b.width / 2);
          if (kind === "top") m[1] = all.y - b.y;
          if (kind === "bottom") m[1] = all.y + all.height - (b.y + b.height);
          if (kind === "middle") m[1] = all.y + all.height / 2 - (b.y + b.height / 2);
          moves.set(e.id, m);
        }
      }
      mapSelected((e) => {
        const m = moves.get(e.id);
        return m ? translateElement(e, m[0], m[1]) : e;
      });
    },

    setLayerFlag(id, flag, value) {
      get().setDoc((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, [flag]: value } : l)) }));
      if ((flag === "visible" && !value) || (flag === "locked" && value)) {
        const doc = get().doc!;
        const onLayer = new Set(doc.elements.filter((e) => e.layer === id).map((e) => e.id));
        set({ selection: get().selection.filter((s) => !onLayer.has(s)) });
      }
    },

    resizePage(w, h, mode, anchor) {
      get().setDoc((d) => {
        if (mode === "scale") {
          const sx = w / d.width;
          const sy = h / d.height;
          const gs = Math.sqrt(sx * sy);
          return {
            ...d,
            width: w,
            height: h,
            grid: { ...d.grid, size: Math.max(8, Math.round(d.grid.size * gs * 100) / 100) },
            elements: d.elements.map((e) => scaleElement(e, sx, sy, { x: 0, y: 0 })),
          };
        }
        const dx = (w - d.width) * anchor[0];
        const dy = (h - d.height) * anchor[1];
        return {
          ...d,
          width: w,
          height: h,
          elements: dx || dy ? d.elements.map((e) => translateElement(e, dx, dy)) : d.elements,
        };
      });
    },

    select(ids) {
      set({ selection: ids });
    },
    toggleSelect(id) {
      const s = get().selection;
      set({ selection: s.includes(id) ? s.filter((x) => x !== id) : [...s, id] });
    },
    selectAll() {
      const doc = get().doc;
      if (!doc) return;
      const visible = new Set(doc.layers.filter((l) => l.visible && !l.locked).map((l) => l.id));
      set({ selection: doc.elements.filter((e) => visible.has(e.layer) && !e.locked).map((e) => e.id) });
    },
    setTool(tool) {
      set({ tool, editingTextId: null });
    },
    setView(v) {
      set({ view: { ...get().view, ...v } });
    },
    zoomAt(factor, p) {
      const v = get().view;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      const k = zoom / v.zoom;
      set({ view: { zoom, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k } });
    },
    fit(vw, vh) {
      const doc = get().doc;
      if (!doc || vw <= 0 || vh <= 0) return;
      const pad = 40;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((vw - pad * 2) / doc.width, (vh - pad * 2) / doc.height)));
      set({ view: { zoom, x: (vw - doc.width * zoom) / 2, y: (vh - doc.height * zoom) / 2 } });
    },
    setShowGrid(v) {
      set({ showGrid: v });
    },
    setSnap(v) {
      set({ snap: v });
    },
    setEditingText(id) {
      set({ editingTextId: id });
    },

    markSaved(version, revision) {
      const s = get();
      set({
        savedVersion: Math.max(s.savedVersion, version),
        revision,
        saveState: s.version === version ? "saved" : "pending",
      });
    },
    setSaveState(saveState) {
      set({ saveState });
    },
    setRevision(revision) {
      set({ revision });
    },
  };
});

/** Creates a text element with a measured box. */
export function makeText(at: Pt, text: string, fontSize: number): TextElement {
  const el: TextElement = {
    id: newId(),
    type: "text",
    x: at.x,
    y: at.y,
    width: 10,
    height: 10,
    rotation: 0,
    opacity: 1,
    layer: "labels",
    text,
    fontSize,
    color: "#1f1a14",
    fontFamily: "serif",
    bold: true,
    outline: "#ffffff",
  };
  const r = relayoutText(el);
  return { ...r, x: at.x - r.width / 2, y: at.y - r.height / 2 };
}
