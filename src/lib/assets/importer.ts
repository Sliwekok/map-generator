// The one asset importer. Scans the assets/ folder, validates every group, SVG and manifest entry,
// and builds the registry the API serves. Nothing else defines built-in assets.
//
// Layout (see assets/README.md):
//   assets/categories.json                 category ids, names, default layer
//   assets/<group>/group.json              group name, access, order + optional per-item metadata
//   assets/<group>/<category>/**/<id>.svg  assets (category = first folder)
//   assets/<group>/patterns/**/<id>.svg    background textures
//   assets/_<anything>                     ignored (drafts / disabled groups)
//
// This file must stay free of runtime imports other than node builtins: `npm run assets:check`
// loads it outside Next.js. Only `import type` from the app.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  AssetAccess,
  AssetCategoryDef,
  AssetDef,
  I18nText,
  LayerId,
  PatternDef,
} from "@/lib/types";

export interface ImportIssue {
  level: "error" | "warning";
  file: string; // relative to the assets folder
  message: string;
}

export interface GroupDef {
  id: string;
  name: I18nText;
  description?: I18nText;
  access: AssetAccess;
  order: number;
  hidden: boolean; // whole group unlisted (its items still render on existing maps)
  assets: AssetDef[];
  patterns: PatternDef[];
}

export interface AssetRegistry {
  version: string;
  categories: AssetCategoryDef[];
  groups: GroupDef[];
  assetsById: Map<string, AssetDef>;
  patternsById: Map<string, PatternDef>;
  issues: ImportIssue[];
}

// Keep in sync with LayerId / ASSET_ACCESS_LEVELS in lib/types.ts (values can't be imported here).
const LAYERS: readonly LayerId[] = ["background", "terrain", "objects", "tokens", "labels"];
const ACCESS: readonly AssetAccess[] = ["free", "user"];

export const IMPORT_LIMITS = {
  maxSvgBytes: 256 * 1024,
  maxDepth: 4, // sub-folders inside a category / patterns folder
  maxCells: 100,
  maxTags: 20,
};

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const PATTERNS_DIR = "patterns";

const GROUP_KEYS = new Set(["name", "description", "access", "order", "hidden", "defaultCategory", "assets", "patterns"]);
const ASSET_KEYS = new Set(["name", "category", "cells", "layer", "tintable", "defaultTint", "tags", "hidden"]);
const PATTERN_KEYS = new Set(["name", "hidden"]);

// Root <svg> attributes that are not carried over to the inner <g>.
const ROOT_SKIP = new Set(["xmlns", "viewbox", "width", "height", "x", "y", "version", "id", "class", "preserveaspectratio", "xml:space", "baseprofile", "enable-background"]);

type Json = Record<string, unknown>;

export function importAssets(root: string): AssetRegistry {
  const issues: ImportIssue[] = [];
  const rel = (p: string) => path.relative(root, p).split(path.sep).join("/") || ".";
  const err = (p: string, message: string) => issues.push({ level: "error", file: rel(p), message });
  const warn = (p: string, message: string) => issues.push({ level: "warning", file: rel(p), message });

  const categories = readCategories(root, err, warn);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const groups: GroupDef[] = [];

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    err(root, "assets folder not found");
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!e.isDirectory() || e.name.startsWith("_") || e.name.startsWith(".")) continue;
    const g = readGroup(path.join(root, e.name), e.name, catById, err, warn);
    if (g) groups.push(g);
  }
  groups.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  // Ids are global: maps store only the id. First group (by order) wins on a clash.
  const assetsById = new Map<string, AssetDef>();
  const patternsById = new Map<string, PatternDef>();
  for (const g of groups) {
    g.assets = g.assets.filter((a) => {
      const prev = assetsById.get(a.id);
      if (prev) {
        err(path.join(root, g.id), `asset id "${a.id}" already used in group "${prev.group}" - skipped`);
        return false;
      }
      assetsById.set(a.id, a);
      return true;
    });
    g.patterns = g.patterns.filter((p) => {
      const prev = patternsById.get(p.id);
      if (prev) {
        err(path.join(root, g.id), `pattern id "${p.id}" already used in group "${prev.group}" - skipped`);
        return false;
      }
      patternsById.set(p.id, p);
      return true;
    });
  }

  const version = crypto
    .createHash("sha1")
    .update(JSON.stringify({ categories, groups }))
    .digest("hex")
    .slice(0, 12);
  return { version, categories, groups, assetsById, patternsById, issues };
}

// ---------------------------------------------------------------------------------------------

type Report = (p: string, message: string) => void;

function readJson(file: string, err: Report): Json | null {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    err(file, "file missing");
    return null;
  }
  try {
    const v = JSON.parse(text.replace(/^﻿/, ""));
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      err(file, "must contain a JSON object");
      return null;
    }
    return v as Json;
  } catch (e) {
    err(file, `invalid JSON: ${(e as Error).message}`);
    return null;
  }
}

function text(v: unknown, fallback: string | null): I18nText | null {
  if (typeof v === "string" && v.trim()) return { en: v.trim(), pl: v.trim() };
  if (v && typeof v === "object") {
    const o = v as Json;
    const en = typeof o.en === "string" ? o.en.trim() : "";
    const pl = typeof o.pl === "string" ? o.pl.trim() : "";
    if (en || pl) return { en: en || pl, pl: pl || en };
  }
  return fallback === null ? null : { en: fallback, pl: fallback };
}

function titleFromId(id: string): string {
  const s = id.replace(/^p-/, "").replace(/[-_]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : id;
}

function unknownKeys(o: Json, allowed: Set<string>, file: string, where: string, warn: Report) {
  for (const k of Object.keys(o)) if (!allowed.has(k) && !k.startsWith("$")) warn(file, `${where}: unknown key "${k}" ignored`);
}

function readCategories(root: string, err: Report, warn: Report): AssetCategoryDef[] {
  const file = path.join(root, "categories.json");
  const j = readJson(file, err);
  if (!j) return [];
  if (!Array.isArray(j.categories)) {
    err(file, `"categories" must be an array`);
    return [];
  }
  const out: AssetCategoryDef[] = [];
  j.categories.forEach((c: unknown, i: number) => {
    const o = (c ?? {}) as Json;
    const id = typeof o.id === "string" ? o.id : "";
    if (!ID_RE.test(id) || id === PATTERNS_DIR) return err(file, `categories[${i}]: invalid id "${id}"`);
    if (out.some((x) => x.id === id)) return err(file, `categories[${i}]: duplicate id "${id}"`);
    const layer = (o.defaultLayer ?? "objects") as LayerId;
    if (!LAYERS.includes(layer)) return err(file, `categories[${i}]: invalid defaultLayer "${String(o.defaultLayer)}"`);
    unknownKeys(o, new Set(["id", "name", "defaultLayer"]), file, `categories[${i}]`, warn);
    out.push({ id, name: text(o.name, titleFromId(id))!, defaultLayer: layer });
  });
  return out;
}

function readGroup(
  dir: string,
  id: string,
  catById: Map<string, AssetCategoryDef>,
  err: Report,
  warn: Report,
): GroupDef | null {
  if (!ID_RE.test(id)) {
    err(dir, `group folder name must match ${ID_RE} - group skipped`);
    return null;
  }
  const file = path.join(dir, "group.json");
  const j = readJson(file, err);
  if (!j) {
    err(dir, "group skipped (needs a valid group.json)");
    return null;
  }
  unknownKeys(j, GROUP_KEYS, file, "group", warn);
  const access = (j.access ?? "free") as AssetAccess;
  if (!ACCESS.includes(access)) {
    err(file, `access must be one of ${ACCESS.join(", ")} - group skipped`);
    return null;
  }
  const order = typeof j.order === "number" && Number.isFinite(j.order) ? j.order : 1000;
  const defaultCategory = typeof j.defaultCategory === "string" ? j.defaultCategory : null;
  if (defaultCategory && !catById.has(defaultCategory)) err(file, `defaultCategory "${defaultCategory}" is not in categories.json`);

  const metaMap = (key: "assets" | "patterns"): Map<string, Json> => {
    const m = new Map<string, Json>();
    const v = j[key];
    if (v === undefined) return m;
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      err(file, `"${key}" must be an object keyed by id`);
      return m;
    }
    for (const [k, x] of Object.entries(v as Json)) {
      if (!x || typeof x !== "object" || Array.isArray(x)) err(file, `${key}.${k}: must be an object`);
      else m.set(k, x as Json);
    }
    return m;
  };
  const assetMeta = metaMap("assets");
  const patternMeta = metaMap("patterns");
  const premium = access !== "free";

  // Collect files: <category>/**.svg, patterns/**.svg and loose *.svg in the group root.
  const assetFiles: { file: string; category: string | null }[] = [];
  const patternFiles: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
    if (e.isDirectory()) {
      if (e.name === PATTERNS_DIR) patternFiles.push(...svgFiles(p, 0, warn));
      else if (catById.has(e.name)) assetFiles.push(...svgFiles(p, 0, warn).map((f) => ({ file: f, category: e.name })));
      else warn(p, `folder is not a category from categories.json (or "${PATTERNS_DIR}") - ignored`);
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".svg")) {
      assetFiles.push({ file: p, category: null });
    } else if (e.isFile() && e.name !== "group.json" && !/^(readme|license)/i.test(e.name)) {
      warn(p, "not an .svg file - ignored");
    }
  }

  const seen = new Set<string>();
  const idOf = (file: string): string | null => {
    const base = path.basename(file).replace(/\.svg$/i, "");
    if (!ID_RE.test(base)) {
      err(file, `file name must be a lower-case id matching ${ID_RE} - skipped`);
      return null;
    }
    if (seen.has(base)) {
      err(file, `id "${base}" appears twice in this group - skipped`);
      return null;
    }
    seen.add(base);
    return base;
  };

  const assets: AssetDef[] = [];
  for (const { file: f, category: folderCat } of assetFiles) {
    const aid = idOf(f);
    if (!aid) continue;
    const meta = assetMeta.get(aid) ?? {};
    assetMeta.delete(aid);
    unknownKeys(meta, ASSET_KEYS, file, `assets.${aid}`, warn);
    const svg = readSvg(f, aid, err, warn);
    if (!svg) continue;

    const category = (typeof meta.category === "string" ? meta.category : null) ?? folderCat ?? defaultCategory;
    if (!category || !catById.has(category)) {
      err(f, category ? `unknown category "${category}" - skipped` : "no category (put it in a category folder or set one in group.json) - skipped");
      continue;
    }
    let cells: [number, number] = [1, 1];
    if (meta.cells !== undefined) {
      const c = meta.cells;
      const ok = Array.isArray(c) && c.length === 2 && c.every((n) => typeof n === "number" && n > 0 && n <= IMPORT_LIMITS.maxCells);
      if (ok) cells = [c[0] as number, c[1] as number];
      else err(file, `assets.${aid}.cells must be [width, height] in cells (0 < n <= ${IMPORT_LIMITS.maxCells}) - using [1, 1]`);
    }
    let layer = catById.get(category)!.defaultLayer;
    if (meta.layer !== undefined) {
      if (LAYERS.includes(meta.layer as LayerId)) layer = meta.layer as LayerId;
      else err(file, `assets.${aid}.layer must be one of ${LAYERS.join(", ")} - using "${layer}"`);
    }
    const usesCurrent = /currentColor/i.test(svg.body);
    const tintable = typeof meta.tintable === "boolean" ? meta.tintable : usesCurrent;
    if (tintable && !usesCurrent) warn(file, `assets.${aid}: tintable but the SVG never uses currentColor`);
    let defaultTint: string | undefined;
    if (meta.defaultTint !== undefined) {
      if (typeof meta.defaultTint === "string" && COLOR_RE.test(meta.defaultTint)) defaultTint = meta.defaultTint;
      else err(file, `assets.${aid}.defaultTint must be a #rgb / #rrggbb colour`);
    }
    let tags: string[] | undefined;
    if (meta.tags !== undefined) {
      if (Array.isArray(meta.tags) && meta.tags.every((x) => typeof x === "string")) {
        tags = (meta.tags as string[]).map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, IMPORT_LIMITS.maxTags);
      } else err(file, `assets.${aid}.tags must be an array of strings`);
    }
    assets.push({
      id: aid,
      name: text(meta.name, titleFromId(aid))!,
      category,
      group: id,
      viewBox: svg.viewBox,
      body: svg.body,
      cells,
      layer,
      ...(tintable ? { tintable } : {}),
      ...(defaultTint ? { defaultTint } : {}),
      ...(tags?.length ? { tags } : {}),
      ...(meta.hidden === true ? { hidden: true } : {}),
      ...(premium ? { premium } : {}),
    });
  }

  const patterns: PatternDef[] = [];
  for (const f of patternFiles) {
    const pid = idOf(f);
    if (!pid) continue;
    const meta = patternMeta.get(pid) ?? {};
    patternMeta.delete(pid);
    unknownKeys(meta, PATTERN_KEYS, file, `patterns.${pid}`, warn);
    const svg = readSvg(f, pid, err, warn);
    if (!svg) continue;
    const [x, y, w, h] = svg.viewBox.split(" ").map(Number);
    if (x !== 0 || y !== 0 || Math.abs(w - h) > 1e-6) {
      err(f, `a texture needs a square viewBox starting at 0 0 (got "${svg.viewBox}") - skipped`);
      continue;
    }
    patterns.push({
      id: pid,
      name: text(meta.name, titleFromId(pid))!,
      group: id,
      size: w,
      body: svg.body,
      ...(meta.hidden === true ? { hidden: true } : {}),
      ...(premium ? { premium } : {}),
    });
  }

  for (const k of assetMeta.keys()) warn(file, `assets.${k}: no matching .svg file`);
  for (const k of patternMeta.keys()) warn(file, `patterns.${k}: no matching .svg file in ${PATTERNS_DIR}/`);

  // Manifest order first (so authors control it), then files not listed, alphabetically.
  const byManifest = (key: "assets" | "patterns") => {
    const listed = j[key] && typeof j[key] === "object" ? Object.keys(j[key] as Json) : [];
    const pos = new Map(listed.map((k, i) => [k, i]));
    return <T extends { id: string }>(a: T, b: T) =>
      (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity) || a.id.localeCompare(b.id);
  };
  assets.sort(byManifest("assets"));
  patterns.sort(byManifest("patterns"));

  if (!assets.length && !patterns.length) warn(dir, "group has no assets or textures");

  return {
    id,
    name: text(j.name, titleFromId(id))!,
    ...(text(j.description, null) ? { description: text(j.description, null)! } : {}),
    access,
    order,
    hidden: j.hidden === true,
    assets,
    patterns,
  };
}

function svgFiles(dir: string, depth: number, warn: Report): string[] {
  if (depth > IMPORT_LIMITS.maxDepth) {
    warn(dir, `nested deeper than ${IMPORT_LIMITS.maxDepth} folders - ignored`);
    return [];
  }
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...svgFiles(p, depth + 1, warn));
    else if (e.isFile() && e.name.toLowerCase().endsWith(".svg")) out.push(p);
    else if (e.isFile() && !/^(readme|license)/i.test(e.name)) warn(p, "not an .svg file - ignored");
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// SVG parsing. Built-in bodies are injected inline into the page, so anything that could run
// script or load external resources is rejected (not silently stripped).

const FORBIDDEN: [RegExp, string][] = [
  [/<!ENTITY|<!DOCTYPE/i, "DOCTYPE / ENTITY declarations"],
  [/<(script|foreignObject|iframe|embed|object|audio|video|handler|listener|animate|set)\b/i, "forbidden element"],
  [/\son[a-z]+\s*=/i, "event handler attribute"],
  [/javascript:|vbscript:/i, "script URL"],
  [/@import|expression\s*\(/i, "CSS import / expression"],
  [/url\(\s*(?!['"]?#)/i, "external url() reference"],
  [/<style\b/i, "<style> element (it would restyle the whole page - use attributes instead)"],
];

function readSvg(file: string, id: string, err: Report, warn: Report): { viewBox: string; body: string } | null {
  let src: string;
  try {
    const st = fs.statSync(file);
    if (st.size > IMPORT_LIMITS.maxSvgBytes) {
      err(file, `larger than ${IMPORT_LIMITS.maxSvgBytes / 1024} KB - skipped`);
      return null;
    }
    src = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  } catch {
    err(file, "cannot read file - skipped");
    return null;
  }
  for (const [re, what] of FORBIDDEN) {
    if (re.test(src)) {
      err(file, `${what} not allowed - skipped`);
      return null;
    }
  }
  const hrefs = [...src.matchAll(/\s(?:xlink:)?href\s*=\s*("|')(.*?)\1/gi)].map((m) => m[2].trim());
  if (hrefs.some((h) => !h.startsWith("#") && !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(h))) {
    err(file, "only #fragment and data:image hrefs are allowed - skipped");
    return null;
  }
  const cleaned = src
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<title[\s\S]*?<\/title>/gi, "")
    .trim();
  const m = cleaned.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/i);
  if (!m) {
    err(file, "must contain exactly one <svg>…</svg> root - skipped");
    return null;
  }
  const attrs = new Map<string, string>();
  for (const a of m[1].matchAll(/([\w:-]+)\s*=\s*("|')(.*?)\2/g)) attrs.set(a[1], a[3]);

  let viewBox = attrs.get("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n)) || viewBox[2] <= 0 || viewBox[3] <= 0) {
    const w = parseFloat(attrs.get("width") ?? "");
    const h = parseFloat(attrs.get("height") ?? "");
    if (!(w > 0 && h > 0) || /%/.test(attrs.get("width") ?? "")) {
      err(file, "needs a viewBox (or numeric width and height) - skipped");
      return null;
    }
    warn(file, "no viewBox - using width/height");
    viewBox = [0, 0, w, h];
  }

  let body = m[2].trim();
  if (!body) {
    err(file, "empty SVG - skipped");
    return null;
  }
  // Prefix internal ids so gradients / clip paths of different assets never collide on one page.
  const ids = [...body.matchAll(/\sid\s*=\s*("|')(.*?)\1/g)].map((x) => x[2]);
  if (ids.length) {
    const map = new Map(ids.map((x) => [x, `a-${id}-${x.replace(/[^\w-]/g, "_")}`]));
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const [from, to] of map) {
      const f = esc(from);
      body = body
        .replace(new RegExp(`(\\sid\\s*=\\s*["'])${f}(["'])`, "g"), `$1${to}$2`)
        .replace(new RegExp(`url\\(\\s*(['"]?)#${f}\\1\\s*\\)`, "g"), `url(#${to})`)
        .replace(new RegExp(`(href\\s*=\\s*["'])#${f}(["'])`, "g"), `$1#${to}$2`);
    }
  }
  // Presentation attributes on the root (fill="none", stroke="currentColor"…) move to a wrapper.
  const carried = [...attrs].filter(([k]) => !ROOT_SKIP.has(k.toLowerCase()) && !k.toLowerCase().startsWith("xmlns"));
  if (carried.length) {
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    body = `<g ${carried.map(([k, v]) => `${k}="${esc(v)}"`).join(" ")}>${body}</g>`;
  }
  body = body.replace(/\s*\n\s*/g, " ");
  return { viewBox: viewBox.join(" "), body };
}
