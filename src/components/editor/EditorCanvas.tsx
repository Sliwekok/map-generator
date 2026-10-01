"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ElementPreview, MapBackground, MapGrid, MapLayer, TextureDefs, elementsByLayer, layerStates, texturesUsed } from "@/components/map/MapRenderer";
import { requestRename } from "@/lib/editor/itemLabel";
import { useEditor, makeText, type View } from "@/lib/editor/store";
import {
  aabb,
  center,
  corners,
  intersects,
  normAngle,
  normBox,
  rotateElementAround,
  rotatePt,
  scaleElement,
  simplify,
  snapValue,
  translateElement,
  unionBox,
  type Box,
  type Pt,
} from "@/lib/editor/geometry";
import { assetElement, pathElement, shapeElement, snapBox, uploadElement } from "@/lib/editor/factory";
import { relayoutText, FONT_STACKS, LINE_HEIGHT } from "@/lib/editor/text";
import { uploadFiles } from "@/lib/editor/actions";
import { addPass, brushElement, brushPx, erasePass, fullyErased, mergeTarget, smoothStroke, styleFrom, type BrushStyle } from "@/lib/editor/brush";
import { useBrush } from "@/lib/editor/brushStore";
import { toast } from "@/lib/client/toasts";
import { useAssets } from "@/lib/client/assets";
import { useUploadMap, useUploads } from "@/lib/client/uploads";
import { useSession } from "@/lib/client/session";
import { useI18n } from "@/lib/i18n";
import { FEET_PER_CELL } from "@/lib/limits";
import { LAYER_ORDER, type BrushElement, type MapContent, type MapElement, type TextElement } from "@/lib/types";
import ContextMenu, { type ContextMenuState } from "./ContextMenu";

export const ASSET_MIME = "application/x-mapforge-asset";

/** How long the wheel has to pause before the map is redrawn at the new zoom. */
const ZOOM_SETTLE_MS = 160;
/** Zoom per wheel delta unit. One mouse-wheel notch (~100) ≈ 5% zoom. */
const WHEEL_ZOOM_SPEED = 0.0005;
/** Zoom per delta unit for Ctrl+wheel / trackpad pinch (pinch sends small deltas). */
const PINCH_ZOOM_SPEED = 0.004;
/** Caps a single wheel event so fast-spinning wheels or line-mode deltas can't jump. */
const MAX_WHEEL_DELTA = 100;

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HANDLES: Record<Handle, [number, number]> = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0],
};
const HANDLE_CURSOR: Record<Handle, string> = {
  nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
};

interface Frame {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
}

type Gesture =
  | { kind: "pan"; sx: number; sy: number; view: View }
  | {
      kind: "move";
      start: Pt;
      base: MapElement[];
      box: Box;
      moved: boolean;
      clickId: string | null;
      sx: number;
      sy: number;
      dx: number; // current offset (snapped), map px
      dy: number;
    }
  | { kind: "marquee"; start: Pt; additive: boolean; baseSel: string[] }
  | { kind: "resize"; handle: Handle; frame: Frame; base: MapElement[] }
  | { kind: "rotate"; pivot: Pt; startAngle: number; base: MapElement[]; single: boolean }
  | { kind: "create"; shape: "rect" | "ellipse"; start: Pt }
  | { kind: "pen"; points: [number, number][] }
  | {
      kind: "brush";
      raw: [number, number][];
      anchor: Pt; // start of a straight (Shift) line
      straight: boolean;
      id: string; // element being painted (new, or the one this stroke continues)
      base: BrushElement | null; // continued element as it was before this stroke
      size: number;
      style: BrushStyle;
      smoothing: number;
      frame: number; // pending requestAnimationFrame (0 = none)
    }
  | { kind: "erase"; raw: [number, number][]; size: number; base: Map<string, BrushElement>; frame: number }
  | { kind: "measure"; start: Pt };

/** Last point of the previous brush stroke - Shift+click draws a straight line from it. */
let lastBrushEnd: Pt | null = null;

export default function EditorCanvas() {
  const { t } = useI18n();
  const { user } = useSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [preview, setPreview] = useState<Box | null>(null);
  const [penPts, setPenPts] = useState<[number, number][] | null>(null);
  const [measure, setMeasure] = useState<{ a: Pt; b: Pt } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  // The stroke being painted is drawn on its own layer on top of the map (and committed on
  // release), so the browser doesn't have to repaint the whole map on every pointer move.
  const [brushPreview, setBrushPreview] = useState<BrushElement | null>(null);
  // Items being dragged: drawn once on a layer of their own that is only moved (CSS transform)
  // while dragging - nothing is re-rendered or repainted per pointer move. Committed on release.
  const [floating, setFloating] = useState<MapElement[] | null>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const selOverlayRef = useRef<SVGGElement>(null);
  const lastPointer = useRef<Pt | null>(null);
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const didFit = useRef<string | null>(null);
  // The map is only drawn once it has been fitted to the viewport (no wasted first paint).
  const [fittedFor, setFittedFor] = useState<string | null>(null);
  const [renderedZoom, setRenderedZoom] = useState(1);
  const renderedZoomRef = useRef(1);
  useEffect(() => {
    renderedZoomRef.current = renderedZoom;
  }, [renderedZoom]);
  /** When the wheel last zoomed - while zooming continuously the map is only scaled, not redrawn. */
  const lastWheel = useRef(0);

  const doc = useEditor((s) => s.doc);
  const mapId = useEditor((s) => s.mapId);
  const view = useEditor((s) => s.view);
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const showGrid = useEditor((s) => s.showGrid);
  const editingTextId = useEditor((s) => s.editingTextId);

  const assets = useAssets((s) => s.byId);
  const patterns = useAssets((s) => s.patternsById);
  const uploads = useUploadMap();

  // ---- viewport size / initial fit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (mapId && size.w > 0 && didFit.current !== mapId) {
      didFit.current = mapId;
      useEditor.getState().fit(size.w, size.h);
      setRenderedZoom(useEditor.getState().view.zoom);
      setFittedFor(mapId);
    }
  }, [mapId, size.w, size.h]);

  // Listen for fit requests from the toolbar / keyboard.
  useEffect(() => {
    const onFit = () => {
      const el = containerRef.current;
      if (el) useEditor.getState().fit(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("mapforge:fit", onFit);
    return () => window.removeEventListener("mapforge:fit", onFit);
  }, []);

  // Center the view on an element (e.g. picked from the item list in the right panel).
  useEffect(() => {
    const onFocus = (ev: Event) => {
      const id = (ev as CustomEvent<{ id: string }>).detail?.id;
      const el = containerRef.current;
      const st = useEditor.getState();
      const target = st.doc?.elements.find((e) => e.id === id);
      if (!el || !target) return;
      const b = aabb(target);
      const { zoom } = st.view;
      st.setView({ x: el.clientWidth / 2 - (b.x + b.width / 2) * zoom, y: el.clientHeight / 2 - (b.y + b.height / 2) * zoom });
    };
    window.addEventListener("mapforge:focus", onFocus);
    return () => window.removeEventListener("mapforge:focus", onFocus);
  }, []);

  // Brush size changed ([ / ] or the panel): resize the outline under the pointer right away.
  useEffect(
    () =>
      useBrush.subscribe(() => {
        const ring = ringRef.current;
        const p = lastPointer.current;
        if (!ring || !p) return;
        const s = useEditor.getState();
        const b = useBrush.getState().settings;
        ring.setAttribute("r", String(brushPx(s.tool === "eraser" ? b.eraserSize : b.size, s.doc?.grid.size || 70) / 2));
      }),
    [],
  );

  // Space = temporary pan
  useEffect(() => {
    const isTyping = () => {
      const a = document.activeElement as HTMLElement | null;
      return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping()) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const toWorld = useCallback((clientX: number, clientY: number): Pt => {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = useEditor.getState().view;
    return { x: (clientX - rect.left - v.x) / v.zoom, y: (clientY - rect.top - v.y) / v.zoom };
  }, []);

  const snapPt = (p: Pt, alt: boolean): Pt => {
    const s = useEditor.getState();
    if (!s.snap || alt || !s.doc) return p;
    const g = s.doc.grid.size;
    return { x: snapValue(p.x, g), y: snapValue(p.y, g) };
  };

  // ---- wheel zoom (native listener so we can preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastWheel.current = performance.now();
      const s = useEditor.getState();
      if (e.shiftKey && !e.ctrlKey) {
        s.setView({ x: s.view.x - (e.deltaY || e.deltaX) });
        return;
      }
      const rect = el.getBoundingClientRect();
      // deltaMode 1 = lines (Firefox), 2 = pages: convert to pixels before scaling
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      const delta = Math.max(-MAX_WHEEL_DELTA, Math.min(MAX_WHEEL_DELTA, e.deltaY * unit));
      const factor = Math.exp(-delta * (e.ctrlKey ? PINCH_ZOOM_SPEED : WHEEL_ZOOM_SPEED));
      s.zoomAt(factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ---- zoom the browser draws the map at
  // Panning only moves the already drawn map (a GPU-composited layer), so it never repaints.
  // A zoom change needs a redraw at the new scale: during a burst of wheel steps the drawn map
  // is just scaled for immediate feedback, and redrawn sharp once the wheel pauses.
  useEffect(() => {
    if (renderedZoom === view.zoom) return;
    const wait = performance.now() - lastWheel.current < ZOOM_SETTLE_MS ? ZOOM_SETTLE_MS : 0;
    const timer = setTimeout(() => setRenderedZoom(view.zoom), wait);
    return () => clearTimeout(timer);
  }, [view.zoom, renderedZoom]);

  // Elements grouped by layer: each layer is its own SVG, re-rendered only when its elements change.
  const byLayer = useMemo(() => (doc ? elementsByLayer(doc.elements) : null), [doc]);
  const textures = useMemo(() => (doc ? texturesUsed(doc.elements, patterns) : []), [doc, patterns]);

  // ---- selection frame
  const selectedEls = useMemo(() => {
    if (!doc) return [];
    const ids = new Set(selection);
    return doc.elements.filter((e) => ids.has(e.id));
  }, [doc, selection]);

  const frame: Frame | null = useMemo(() => {
    if (!selectedEls.length) return null;
    if (selectedEls.length === 1) {
      const e = selectedEls[0];
      const c = center(e);
      return { cx: c.x, cy: c.y, w: e.width, h: e.height, angle: e.rotation };
    }
    const b = unionBox(selectedEls.map(aabb))!;
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, w: b.width, h: b.height, angle: 0 };
  }, [selectedEls]);

  const selectionEditable = useMemo(() => {
    if (!doc) return false;
    const lockedLayers = new Set(doc.layers.filter((l) => l.locked).map((l) => l.id));
    return selectedEls.length > 0 && selectedEls.every((e) => !e.locked && !lockedLayers.has(e.layer));
  }, [doc, selectedEls]);

  // ---- pointer handling
  const onPointerDown = (e: React.PointerEvent) => {
    const s = useEditor.getState();
    if (!s.doc || s.editingTextId) {
      if (s.editingTextId) s.setEditingText(null);
      return;
    }
    const target = e.target as Element;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const world = toWorld(e.clientX, e.clientY);

    // Right button is handled by onContextMenu.
    if (e.button === 2) return;

    // Pan: middle button, space held, or pan tool
    if (e.button === 1 || spaceDown || s.tool === "pan") {
      e.preventDefault();
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, view: s.view };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;

    if (s.tool === "rect" || s.tool === "ellipse") {
      const p = snapPt(world, e.altKey);
      gesture.current = { kind: "create", shape: s.tool, start: p };
      setPreview({ x: p.x, y: p.y, width: 0, height: 0 });
      return;
    }
    if (s.tool === "pen") {
      gesture.current = { kind: "pen", points: [[world.x, world.y]] };
      setPenPts([[world.x, world.y]]);
      return;
    }
    if (s.tool === "brush") {
      const b = useBrush.getState().settings;
      const grid = s.doc.grid.size || 70;
      const layer = s.doc.layers.find((l) => l.id === b.layer);
      if (layer?.locked || layer?.visible === false) {
        toast(t(layer.locked ? "editor.brush.layerLocked" : "editor.brush.layerHidden"), "error");
        return;
      }
      const style = styleFrom(b, grid);
      const size = brushPx(b.size, grid);
      const straight = e.shiftKey && lastBrushEnd;
      const start = straight ? lastBrushEnd! : e.shiftKey ? snapPt(world, e.altKey) : world;
      const raw: [number, number][] = straight ? [[start.x, start.y], [world.x, world.y]] : [[world.x, world.y]];
      const target = b.merge ? mergeTarget(s.doc, start, style) : null;
      const first = target ? addPass(target, raw, size) : brushElement(raw, size, style);
      gesture.current = {
        kind: "brush",
        raw,
        anchor: start,
        straight: !!straight,
        id: first.id,
        base: target,
        size,
        style,
        smoothing: b.smoothing,
        frame: 0,
      };
      setBrushPreview(first);
      return;
    }
    if (s.tool === "eraser") {
      const size = brushPx(useBrush.getState().settings.eraserSize, s.doc.grid.size || 70);
      s.beginGesture();
      const g: Gesture = { kind: "erase", raw: [[world.x, world.y]], size, base: new Map(), frame: 0 };
      gesture.current = g;
      eraseStep(g, s.view.zoom);
      return;
    }
    if (s.tool === "measure") {
      const p = s.snap && !e.altKey ? cellCenter(world, s.doc.grid.size) : world;
      gesture.current = { kind: "measure", start: p };
      setMeasure({ a: p, b: p });
      return;
    }
    if (s.tool === "text") {
      // Prevent the browser's mousedown focus change from immediately blurring the new textarea.
      e.preventDefault();
      const el = makeText(world, t("editor.defaultText"), Math.max(16, Math.round(s.doc.grid.size * 0.45)));
      s.addElements([el]);
      s.setTool("select");
      s.setEditingText(el.id);
      return;
    }

    // --- select tool
    const handleEl = target.closest("[data-handle]");
    if (handleEl && frame) {
      const h = handleEl.getAttribute("data-handle")!;
      s.beginGesture();
      if (h === "rot") {
        const pivot = { x: frame.cx, y: frame.cy };
        gesture.current = {
          kind: "rotate",
          pivot,
          startAngle: Math.atan2(world.y - pivot.y, world.x - pivot.x),
          base: selectedEls,
          single: selectedEls.length === 1,
        };
      } else {
        gesture.current = { kind: "resize", handle: h as Handle, frame, base: selectedEls };
      }
      return;
    }

    const elNode = target.closest("[data-el]");
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    if (elNode) {
      const id = elNode.getAttribute("data-el")!;
      let sel = s.selection;
      let clickId: string | null = null;
      if (additive) {
        s.toggleSelect(id);
        sel = useEditor.getState().selection;
        if (!sel.includes(id)) return; // deselected -> no drag
      } else if (!sel.includes(id)) {
        sel = [id];
        s.select(sel);
      } else {
        clickId = id; // click without drag on an already-selected item -> select only it
      }
      const ids = new Set(sel);
      const base = s.doc.elements.filter((x) => ids.has(x.id));
      s.beginGesture();
      gesture.current = {
        kind: "move",
        start: world,
        base,
        box: unionBox(base.map(aabb))!,
        moved: false,
        clickId,
        sx: e.clientX,
        sy: e.clientY,
        dx: 0,
        dy: 0,
      };
      return;
    }

    // empty space -> marquee
    if (!additive) s.select([]);
    gesture.current = { kind: "marquee", start: world, additive, baseSel: additive ? s.selection : [] };
    setMarquee({ x: world.x, y: world.y, width: 0, height: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    const s = useEditor.getState();
    const world = toWorld(e.clientX, e.clientY);
    window.dispatchEvent(new CustomEvent("mapforge:cursor", { detail: world }));
    lastPointer.current = world;
    moveRing(world);
    if (!g || !s.doc) return;
    const doc = s.doc;

    switch (g.kind) {
      case "pan": {
        s.setView({ x: g.view.x + (e.clientX - g.sx), y: g.view.y + (e.clientY - g.sy) });
        break;
      }
      case "move": {
        if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 3) return;
        if (!g.moved) {
          g.moved = true;
          const lockedLayers = new Set(doc.layers.filter((l) => l.locked).map((l) => l.id));
          g.base = g.base.filter((b) => !b.locked && !lockedLayers.has(b.layer));
          setFloating(g.base.length ? g.base : null);
        }
        let dx = world.x - g.start.x;
        let dy = world.y - g.start.y;
        if (s.snap && !e.altKey && doc.grid.size > 0) {
          const target = snapBox({ ...g.box, x: g.box.x + dx, y: g.box.y + dy }, doc.grid.size);
          dx = target.x - g.box.x;
          dy = target.y - g.box.y;
        }
        g.dx = dx;
        g.dy = dy;
        placeFloating(dx, dy);
        break;
      }
      case "marquee": {
        const box = normBox(g.start, world);
        setMarquee(box);
        const visible = new Set(doc.layers.filter((l) => l.visible && !l.locked).map((l) => l.id));
        const hits = doc.elements.filter((el) => visible.has(el.layer) && !el.locked && intersects(aabb(el), box)).map((el) => el.id);
        s.select(g.additive ? Array.from(new Set([...g.baseSel, ...hits])) : hits);
        break;
      }
      case "resize": {
        const f = g.frame;
        const c = { x: f.cx, y: f.cy };
        const p0 = f.angle === 0 ? snapPt(world, e.altKey) : world;
        const local = rotatePt(p0, c, -f.angle);
        const lx = local.x - c.x;
        const ly = local.y - c.y;
        const [hx, hy] = HANDLES[g.handle];
        const anchor = { x: (-hx * f.w) / 2, y: (-hy * f.h) / 2 };
        let sx = hx ? Math.max(0.01, ((lx - anchor.x) * hx) / f.w) : 1;
        let sy = hy ? Math.max(0.01, ((ly - anchor.y) * hy) / f.h) : 1;
        const hasText = g.base.some((b) => b.type === "text");
        if (hx && hy && (!e.shiftKey || hasText)) {
          const k = Math.max(sx, sy);
          sx = k;
          sy = k;
        }
        const pivot = rotatePt({ x: c.x + anchor.x, y: c.y + anchor.y }, c, f.angle);
        const byId = new Map(g.base.map((b) => [b.id, scaleElement(b, sx, sy, pivot, f.angle)]));
        s.setDoc((d) => ({ ...d, elements: d.elements.map((el) => byId.get(el.id) ?? el) }), { history: false });
        break;
      }
      case "rotate": {
        const a = Math.atan2(world.y - g.pivot.y, world.x - g.pivot.x);
        let deg = ((a - g.startAngle) * 180) / Math.PI;
        if (e.shiftKey || (s.snap && !e.altKey)) {
          const target = g.single ? g.base[0].rotation + deg : deg;
          deg = Math.round(target / 15) * 15 - (g.single ? g.base[0].rotation : 0);
        }
        const byId = new Map(
          g.base.map((b) => [
            b.id,
            g.single ? { ...b, rotation: normAngle(b.rotation + deg) } : rotateElementAround(b, g.pivot, deg),
          ]),
        );
        s.setDoc((d) => ({ ...d, elements: d.elements.map((el) => byId.get(el.id) ?? el) }), { history: false });
        break;
      }
      case "create": {
        let p = snapPt(world, e.altKey);
        if (e.shiftKey) {
          const d = Math.max(Math.abs(p.x - g.start.x), Math.abs(p.y - g.start.y));
          p = { x: g.start.x + Math.sign(p.x - g.start.x || 1) * d, y: g.start.y + Math.sign(p.y - g.start.y || 1) * d };
        }
        setPreview(normBox(g.start, p));
        break;
      }
      case "pen": {
        if (e.shiftKey) {
          const p = snapPt(world, e.altKey);
          const first = g.points[0];
          g.points = [first, [p.x, p.y]];
        } else {
          const last = g.points[g.points.length - 1];
          if (Math.hypot(world.x - last[0], world.y - last[1]) * s.view.zoom >= 2) g.points.push([world.x, world.y]);
        }
        setPenPts([...g.points]);
        break;
      }
      case "brush": {
        g.straight = e.shiftKey;
        if (e.shiftKey) {
          const p = s.snap && !e.altKey ? snapPt(world, false) : world;
          g.raw = [[g.anchor.x, g.anchor.y], [p.x, p.y]];
        } else {
          const last = g.raw[g.raw.length - 1];
          if (Math.hypot(world.x - last[0], world.y - last[1]) * s.view.zoom < 1.5) return;
          g.raw.push([world.x, world.y]);
        }
        // Pointer events can outpace frames: redraw at most once per frame.
        if (!g.frame) {
          g.frame = requestAnimationFrame(() => {
            g.frame = 0;
            setBrushPreview(paintStep(g, useEditor.getState().view.zoom));
          });
        }
        break;
      }
      case "erase": {
        const last = g.raw[g.raw.length - 1];
        if (Math.hypot(world.x - last[0], world.y - last[1]) * s.view.zoom < 1.5) return;
        g.raw.push([world.x, world.y]);
        if (!g.frame) {
          g.frame = requestAnimationFrame(() => {
            g.frame = 0;
            eraseStep(g, useEditor.getState().view.zoom);
          });
        }
        break;
      }
      case "measure": {
        const p = s.snap && !e.altKey ? cellCenter(world, doc.grid.size) : world;
        setMeasure({ a: g.start, b: p });
        break;
      }
    }
  };

  /** The element as it looks with the current stroke (smoothed) applied. */
  const paintStep = (g: Extract<Gesture, { kind: "brush" }>, zoom: number): BrushElement => {
    const pts = g.straight ? g.raw : smoothStroke(g.raw, g.size, g.smoothing, zoom);
    if (g.base) return addPass(g.base, pts, g.size);
    return { ...brushElement(pts, g.size, g.style), id: g.id };
  };

  /** Applies the eraser stroke to every editable painted element it has touched so far. */
  const eraseStep = (g: Extract<Gesture, { kind: "erase" }>, zoom: number) => {
    const s = useEditor.getState();
    const doc = s.doc;
    if (!doc) return;
    const r = g.size / 2;
    const recent = g.raw.slice(-2);
    const open = new Set(doc.layers.filter((l) => l.visible && !l.locked).map((l) => l.id));
    for (const el of doc.elements) {
      if (el.type !== "brush" || g.base.has(el.id) || el.locked || !open.has(el.layer)) continue;
      const b = aabb(el);
      if (recent.some(([x, y]) => x >= b.x - r && x <= b.x + b.width + r && y >= b.y - r && y <= b.y + b.height + r)) g.base.set(el.id, el);
    }
    if (!g.base.size) return;
    // Only strokes under the latest movement change; the others keep what they already got.
    const [ax, ay] = recent[0];
    const [bx, by] = recent[recent.length - 1];
    const seg = { x: Math.min(ax, bx) - r, y: Math.min(ay, by) - r, width: Math.abs(bx - ax) + 2 * r, height: Math.abs(by - ay) + 2 * r };
    const ids = [...g.base.keys()].filter((id) => {
      const el = doc.elements.find((x) => x.id === id);
      return !!el && intersects(aabb(el), seg);
    });
    if (!ids.length) return;
    const pts = smoothStroke(g.raw, g.size, 0.2, zoom);
    s.updateElements(ids, (el) => (el.type === "brush" ? erasePass(g.base.get(el.id)!, pts, g.size) : el), { history: false });
  };

  /** Moves the dragged items' layer and the selection outline (directly - no re-render per move). */
  const placeFloating = (dx: number, dy: number) => {
    const rz = renderedZoomRef.current;
    if (floatRef.current) floatRef.current.style.transform = dx || dy ? `translate(${dx * rz}px, ${dy * rz}px)` : "";
    if (dx || dy) selOverlayRef.current?.setAttribute("transform", `translate(${dx} ${dy})`);
    else selOverlayRef.current?.removeAttribute("transform");
  };

  /** Brush / eraser outline following the pointer (updated directly - no re-render per move). */
  const moveRing = (world: Pt | null) => {
    const ring = ringRef.current;
    if (!ring) return;
    const s = useEditor.getState();
    if (!world || (s.tool !== "brush" && s.tool !== "eraser") || !s.doc) {
      ring.setAttribute("visibility", "hidden");
      return;
    }
    const b = useBrush.getState().settings;
    const px = brushPx(s.tool === "eraser" ? b.eraserSize : b.size, s.doc.grid.size || 70);
    ring.setAttribute("cx", String(world.x));
    ring.setAttribute("cy", String(world.y));
    ring.setAttribute("r", String(px / 2));
    ring.setAttribute("visibility", "visible");
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    setPanning(false);
    const s = useEditor.getState();
    if (!g || !s.doc) return;
    switch (g.kind) {
      case "move": {
        if (g.moved && (g.dx || g.dy) && g.base.length) {
          const moved = new Map(g.base.map((b) => [b.id, translateElement(b, g.dx, g.dy)]));
          s.setDoc((d) => ({ ...d, elements: d.elements.map((el) => moved.get(el.id) ?? el) }), { history: false });
        }
        s.endGesture();
        placeFloating(0, 0);
        setFloating(null);
        if (!g.moved && g.clickId) s.select([g.clickId]);
        break;
      }
      case "resize":
      case "rotate":
        s.endGesture();
        break;
      case "marquee":
        setMarquee(null);
        break;
      case "create": {
        if (preview) {
          s.addElements([shapeElement(g.shape, preview, s.doc)]);
          s.setTool("select");
        }
        setPreview(null);
        break;
      }
      case "pen": {
        const pts = g.points.length > 2 ? simplify(g.points, 1 / s.view.zoom) : g.points;
        const el = pathElement(pts, s.doc);
        if (el) s.addElements([el], false);
        setPenPts(null);
        break;
      }
      case "brush": {
        if (g.frame) cancelAnimationFrame(g.frame);
        const el = paintStep(g, s.view.zoom);
        if (g.base) s.updateElements([g.base.id], () => el);
        else s.addElements([el], false);
        setBrushPreview(null);
        const last = g.raw[g.raw.length - 1];
        lastBrushEnd = { x: last[0], y: last[1] };
        break;
      }
      case "erase": {
        if (g.frame) cancelAnimationFrame(g.frame);
        eraseStep(g, s.view.zoom);
        const gone = [...g.base.keys()].filter((id) => {
          const el = useEditor.getState().doc?.elements.find((x) => x.id === id);
          return el?.type === "brush" && fullyErased(el);
        });
        if (gone.length) {
          const del = new Set(gone);
          s.setDoc((d) => ({ ...d, elements: d.elements.filter((x) => !del.has(x.id)) }), { history: false });
          s.select(s.selection.filter((id) => !del.has(id)));
        }
        s.endGesture();
        break;
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const s = useEditor.getState();
    if (!s.doc || s.tool !== "select" || s.editingTextId) return;
    // Pointer capture retargets the event to the canvas, so look up the item under the cursor.
    const node =
      (e.target as Element).closest("[data-el]") ??
      document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.closest("[data-el]"))?.closest("[data-el]");
    const id = node?.getAttribute("data-el");
    const el = id ? s.doc.elements.find((x) => x.id === id) : undefined;
    if (!el) return;
    s.select([el.id]);
    if (el.type === "text") s.setEditingText(el.id);
    // Any other item: rename it in the item list.
    else requestRename(el.id);
  };

  // ---- right-click menu
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const s = useEditor.getState();
    if (!s.doc || s.editingTextId || gesture.current) return;
    const world = toWorld(e.clientX, e.clientY);
    // Locked items (and items when a drawing tool is active) don't receive pointer events,
    // so fall back to a geometric hit test to still offer e.g. "Unlock".
    const node = (e.target as Element).closest("[data-el]");
    const id = node?.getAttribute("data-el") ?? hitTest(s.doc, world);
    if (id) {
      if (!s.selection.includes(id)) s.select([id]);
    } else {
      s.select([]);
    }
    if (s.tool !== "select") s.setTool("select");
    setCtxMenu({ x: e.clientX, y: e.clientY, world });
  };

  // ---- drag & drop from library / OS
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(ASSET_MIME) || e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const s = useEditor.getState();
    if (!s.doc) return;
    const world = toWorld(e.clientX, e.clientY);
    const assetId = e.dataTransfer.getData(ASSET_MIME);
    if (assetId) {
      const def = useAssets.getState().byId[assetId];
      if (def) s.addElements([assetElement(def, world, s.doc, s.snap)]);
      else {
        // One or more uploads ("u:<id>" per line) dragged from My files.
        const g = s.doc.grid.size || 70;
        const els = assetId
          .split("\n")
          .slice(0, 50)
          .map((id) => useUploads.getState().byId[id.trim().replace(/^u:/, "")])
          .filter((up): up is NonNullable<typeof up> => !!up)
          .map((up, i) => uploadElement(up, { x: world.x + (i * g) / 2, y: world.y + (i * g) / 2 }, s.doc!, s.snap));
        if (els.length) s.addElements(els);
      }
      return;
    }
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void uploadFiles(files, user, t, world);
  };

  if (!doc) return null;

  const z = view.zoom;
  const hs = 9 / z; // handle size in map units
  const editing = editingTextId ? (doc.elements.find((x) => x.id === editingTextId) as TextElement | undefined) : undefined;
  // While a stroke continues an existing element, the overlay shows that element - hide the original.
  const hiddenIds = [
    ...(editing ? [editing.id] : []),
    ...(brushPreview && doc.elements.some((x) => x.id === brushPreview.id) ? [brushPreview.id] : []),
    ...(floating ?? []).map((x) => x.id),
  ];
  // Per layer, so the other layers' memoised content stays untouched.
  const hiddenByLayer: Partial<Record<string, Set<string>>> = {};
  if (hiddenIds.length) {
    const ids = new Set(hiddenIds);
    for (const el of doc.elements) if (ids.has(el.id)) (hiddenByLayer[el.layer] ??= new Set()).add(el.id);
  }
  const floatingByLayer = floating ? elementsByLayer(floating) : null;
  const layerState = layerStates(doc);
  const rz = renderedZoom;
  // Items are hit-testable only with the select tool (pan / drawing tools work on the empty canvas).
  const hits = tool === "select" && !spaceDown;
  const layerSvg = (key: string, children: React.ReactNode, testId?: string) => (
    <svg
      key={key}
      width={doc.width * rz}
      height={doc.height * rz}
      viewBox={`0 0 ${doc.width} ${doc.height}`}
      preserveAspectRatio="none"
      className="absolute left-0 top-0 block"
      // Own compositing layer: editing one layer doesn't repaint the others.
      style={{ willChange: "transform", pointerEvents: "none" }}
      data-testid={testId}
    >
      {children}
    </svg>
  );

  const cursor =
    panning ? "grabbing" : spaceDown || tool === "pan" ? "grab" : tool === "text" ? "text" : tool === "select" ? "default" : "crosshair";
  const painting = (tool === "brush" || tool === "eraser") && !spaceDown;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-slate-800 select-none touch-none"
      style={{ cursor, backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => {
        lastPointer.current = null;
        moveRing(null);
      }}
      onDoubleClick={onDoubleClick}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
      data-testid="editor-canvas"
    >
      {fittedFor === mapId && byLayer && (
        <div
          data-testid="map-view"
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: doc.width * rz,
            height: doc.height * rz,
            transform: `translate(${view.x}px, ${view.y}px) scale(${z / rz})`,
            willChange: "transform",
            boxShadow: "6px 8px 0 rgba(0,0,0,0.45)",
            outline: "1px solid rgba(0,0,0,0.6)",
            // Set here, not inherited from the canvas: changing the canvas cursor (tools, panning)
            // would otherwise restyle every node of the map.
            cursor: "default",
          }}
        >
          {layerSvg("bg", <MapBackground doc={doc} idPrefix="ed" patterns={patterns} />)}
          {textures.length > 0 && (
            <svg width={0} height={0} className="absolute" aria-hidden>
              <TextureDefs textures={textures} idPrefix="ed" />
            </svg>
          )}
          {LAYER_ORDER.map((layerId) => {
            const ls = layerState[layerId];
            if (ls && !ls.visible) return null;
            return layerSvg(
              layerId,
              <g pointerEvents={hits ? "auto" : "none"}>
                <MapLayer
                  layerId={layerId}
                  elements={byLayer[layerId]}
                  locked={!!ls?.locked}
                  idPrefix="ed"
                  interactive
                  hidden={hiddenByLayer[layerId] ?? null}
                  assetImages
                  assets={assets}
                  patterns={patterns}
                  uploads={uploads}
                />
              </g>,
            );
          })}
          {showGrid && doc.grid.enabled && layerSvg("grid", <MapGrid doc={doc} idPrefix="ed" />)}
          {floatingByLayer && (
            <div ref={floatRef} className="absolute left-0 top-0" style={{ willChange: "transform" }} data-testid="drag-layer">
              {layerSvg(
                "floating",
                LAYER_ORDER.map((layerId) =>
                  floatingByLayer[layerId].length ? (
                    <MapLayer
                      key={layerId}
                      layerId={layerId}
                      elements={floatingByLayer[layerId]}
                      locked={false}
                      idPrefix="ed"
                      assetImages
                      assets={assets}
                      patterns={patterns}
                      uploads={uploads}
                    />
                  ) : null,
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* Selection, handles and drawing previews: a light layer of its own on top of the map. */}
      <svg width="100%" height="100%" className="absolute inset-0 block" style={{ pointerEvents: "none", willChange: "transform" }}>
        <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>

          <g ref={selOverlayRef}>
            {/* per-element outlines */}
            {selectedEls.map((el) => (
              <polygon
                key={el.id}
                points={corners(el).map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={selectionEditable ? "#f59e0b" : "#ef4444"}
                strokeWidth={1.5 / z}
                strokeDasharray={selectionEditable ? undefined : `${4 / z} ${3 / z}`}
                pointerEvents="none"
              />
            ))}

            {/* transform frame */}
            {frame && selectionEditable && tool === "select" && !editing && (
              <g transform={`translate(${frame.cx} ${frame.cy}) rotate(${frame.angle})`}>
                {selectedEls.length > 1 && (
                  <rect
                    x={-frame.w / 2}
                    y={-frame.h / 2}
                    width={frame.w}
                    height={frame.h}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={1 / z}
                    strokeDasharray={`${6 / z} ${4 / z}`}
                    pointerEvents="none"
                  />
                )}
                <line x1={0} y1={-frame.h / 2} x2={0} y2={-frame.h / 2 - 26 / z} stroke="#f59e0b" strokeWidth={1.5 / z} />
                <circle
                  data-handle="rot"
                  cx={0}
                  cy={-frame.h / 2 - 26 / z}
                  r={hs * 0.7}
                  fill="#fff"
                  stroke="#f59e0b"
                  strokeWidth={2 / z}
                  style={{ cursor: "grab", pointerEvents: "all" }}
                />
                {(Object.keys(HANDLES) as Handle[]).map((h) => {
                  const [hx, hy] = HANDLES[h];
                  return (
                    <rect
                      key={h}
                      data-handle={h}
                      x={(hx * frame.w) / 2 - hs / 2}
                      y={(hy * frame.h) / 2 - hs / 2}
                      width={hs}
                      height={hs}
                      fill="#fff"
                      stroke="#f59e0b"
                      strokeWidth={1.5 / z}
                      style={{ cursor: HANDLE_CURSOR[h], pointerEvents: "all" }}
                    />
                  );
                })}
              </g>
            )}

          </g>

          {marquee && (
            <rect
              {...marquee}
              fill="rgba(245,158,11,0.12)"
              stroke="#f59e0b"
              strokeWidth={1 / z}
              strokeDasharray={`${4 / z} ${3 / z}`}
              pointerEvents="none"
            />
          )}
          {preview &&
            (tool === "ellipse" ? (
              <ellipse
                cx={preview.x + preview.width / 2}
                cy={preview.y + preview.height / 2}
                rx={preview.width / 2}
                ry={preview.height / 2}
                fill="rgba(77,143,196,0.4)"
                stroke="#3b2f23"
                strokeWidth={2 / z}
                pointerEvents="none"
              />
            ) : (
              <rect {...preview} fill="rgba(139,90,43,0.4)" stroke="#3b2f23" strokeWidth={2 / z} pointerEvents="none" />
            ))}
          {penPts && penPts.length > 1 && (
            <polyline
              points={penPts.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke="#3b2f23"
              strokeWidth={Math.max(2, Math.round(doc.grid.size * 0.1))}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}
          {measure && tool === "measure" && <MeasureOverlay a={measure.a} b={measure.b} z={z} grid={doc.grid.size} t={t} />}
        </g>
      </svg>

      {painting && (
        // Separate layer (own compositing surface): the live stroke and the brush outline
        // repaint without touching the map below.
        <svg width="100%" height="100%" className="pointer-events-none absolute inset-0 block" style={{ willChange: "transform" }}>
          <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>
            {brushPreview && (
              <>
                <defs>
                  <clipPath id="pv-clip">
                    <rect x={0} y={0} width={doc.width} height={doc.height} />
                  </clipPath>
                </defs>
                <g clipPath="url(#pv-clip)" data-testid="brush-preview">
                  <ElementPreview el={brushPreview} idPrefix="pv" patterns={patterns} uploads={uploads} />
                </g>
              </>
            )}
            <circle
              ref={ringRef}
              visibility="hidden"
              fill={tool === "eraser" ? "rgba(255,255,255,0.12)" : "none"}
              stroke={tool === "eraser" ? "#f87171" : "#fbbf24"}
              strokeWidth={1.5 / z}
              strokeDasharray={tool === "eraser" ? `${4 / z} ${3 / z}` : undefined}
              data-testid="brush-ring"
            />
          </g>
        </svg>
      )}

      {editing && <TextEditorOverlay el={editing} view={view} />}

      {ctxMenu && <ContextMenu menu={ctxMenu} onClose={closeCtxMenu} />}

      {dragOver && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-xl border-2 border-dashed border-amber-400 bg-amber-400/10 text-lg font-semibold text-amber-200">
          {t("editor.dropHere")}
        </div>
      )}
    </div>
  );
}

/** Top-most element (on a visible layer) whose rotated box contains the point. */
function hitTest(doc: MapContent, p: Pt): string | null {
  for (const layerId of [...LAYER_ORDER].reverse()) {
    const ls = doc.layers.find((l) => l.id === layerId);
    if (ls && !ls.visible) continue;
    for (let i = doc.elements.length - 1; i >= 0; i--) {
      const el = doc.elements[i];
      if (el.layer !== layerId) continue;
      const c = center(el);
      const local = el.rotation ? rotatePt(p, c, -el.rotation) : p;
      if (local.x >= el.x && local.x <= el.x + el.width && local.y >= el.y && local.y <= el.y + el.height) return el.id;
    }
  }
  return null;
}

function cellCenter(p: Pt, g: number): Pt {
  return { x: Math.floor(p.x / g) * g + g / 2, y: Math.floor(p.y / g) * g + g / 2 };
}

function MeasureOverlay({ a, b, z, grid, t }: { a: Pt; b: Pt; z: number; grid: number; t: ReturnType<typeof useI18n>["t"] }) {
  // D&D 5e grid rule: diagonals count as one cell -> Chebyshev distance.
  const cells = Math.round((Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / grid) * 10) / 10;
  const label = t("editor.statusBar.measure", { cells, feet: Math.round(cells * FEET_PER_CELL * 10) / 10 });
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return (
    <g pointerEvents="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#111" strokeWidth={5 / z} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#facc15" strokeWidth={2.5 / z} strokeDasharray={`${8 / z} ${5 / z}`} />
      <circle cx={a.x} cy={a.y} r={5 / z} fill="#facc15" stroke="#111" strokeWidth={1.5 / z} />
      <circle cx={b.x} cy={b.y} r={5 / z} fill="#facc15" stroke="#111" strokeWidth={1.5 / z} />
      <g transform={`translate(${mx} ${my - 18 / z}) scale(${1 / z})`}>
        <rect x={-label.length * 3.6 - 8} y={-13} width={label.length * 7.2 + 16} height={24} rx={6} fill="#111" opacity={0.85} />
        <text textAnchor="middle" y={4} fontSize={13} fill="#facc15" fontFamily="system-ui, sans-serif" fontWeight="600">
          {label}
        </text>
      </g>
    </g>
  );
}

/** Inline text editing: a textarea placed over the text element. */
function TextEditorOverlay({ el, view }: { el: TextElement; view: View }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(el.text);
  const done = useRef(false);

  useEffect(() => {
    useEditor.getState().beginGesture();
    const raf = requestAnimationFrame(() => {
      const ta = ref.current;
      if (ta) {
        ta.focus();
        ta.select();
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (!done.current) finish(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(commit: boolean) {
    if (done.current) return;
    done.current = true;
    const s = useEditor.getState();
    if (!commit) {
      const base = s.gestureBase;
      if (base) s.setDoc(() => base, { history: false });
    } else {
      const cur = s.doc?.elements.find((x) => x.id === el.id) as TextElement | undefined;
      if (cur && !cur.text.trim()) {
        s.setDoc((d) => ({ ...d, elements: d.elements.filter((x) => x.id !== el.id) }), { history: false });
        s.select([]);
      }
    }
    s.endGesture();
    s.setEditingText(null);
  }

  const update = (text: string) => {
    setValue(text);
    useEditor
      .getState()
      .updateElements([el.id], (x) => (x.type === "text" ? relayoutText({ ...x, text }) : x), { history: false });
  };

  const z = view.zoom;
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => update(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") finish(false);
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) finish(true);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-10 resize-none overflow-hidden rounded bg-white/85 p-0 outline-2 outline-amber-500"
      style={{
        left: el.x * z + view.x,
        top: el.y * z + view.y,
        width: Math.max(60, (el.width + el.fontSize) * z),
        height: Math.max(24, (el.height + el.fontSize * 0.3) * z),
        fontSize: el.fontSize * z,
        lineHeight: LINE_HEIGHT,
        fontFamily: FONT_STACKS[el.fontFamily],
        fontWeight: el.bold ? "bold" : "normal",
        fontStyle: el.italic ? "italic" : "normal",
        color: el.color,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        transformOrigin: "center",
      }}
    />
  );
}
