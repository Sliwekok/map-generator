import "server-only";
import fs from "node:fs";
import path from "node:path";
import { importAssets, type AssetRegistry } from "@/lib/assets/importer";
import { canUseAccess } from "@/lib/assets/access";
import type { AssetDef, AssetLibrary, CatalogItem, PatternDef, SessionUser } from "@/lib/types";

// Server-side access to the asset registry built by the importer (lib/assets/importer.ts).
// The assets/ folder is scanned once per process; in development (or with ASSETS_WATCH=1)
// it is re-scanned when a file changes, so new SVGs show up without a restart.

// (traced explicitly via outputFileTracingIncludes in next.config.ts)
export const ASSETS_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.ASSETS_DIR || path.join(process.cwd(), "assets"));
const WATCH = process.env.NODE_ENV !== "production" || process.env.ASSETS_WATCH === "1";
const CHECK_EVERY_MS = 1500;

let cache: { reg: AssetRegistry; sig: string; checkedAt: number } | null = null;

/** Cheap fingerprint of the folder tree (names, sizes, mtimes). */
function signature(dir: string, depth = 0): string {
  if (depth > 8) return "";
  let out = "";
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return "missing";
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out += `${e.name}/{${signature(p, depth + 1)}}`;
    else {
      try {
        const st = fs.statSync(p);
        out += `${e.name}:${st.size}:${st.mtimeMs};`;
      } catch {
        /* removed while scanning */
      }
    }
  }
  return out;
}

function logIssues(reg: AssetRegistry) {
  const errors = reg.issues.filter((i) => i.level === "error");
  const warnings = reg.issues.length - errors.length;
  const assets = reg.groups.reduce((n, g) => n + g.assets.length, 0);
  const patterns = reg.groups.reduce((n, g) => n + g.patterns.length, 0);
  console.info(`[assets] ${reg.groups.length} groups, ${assets} assets, ${patterns} textures (v${reg.version})`);
  for (const i of reg.issues.slice(0, 50)) (i.level === "error" ? console.error : console.warn)(`[assets] ${i.level}: ${i.file}: ${i.message}`);
  if (reg.issues.length > 50) console.warn(`[assets] … ${reg.issues.length - 50} more (run npm run assets:check)`);
  if (errors.length || warnings) console.warn(`[assets] ${errors.length} errors, ${warnings} warnings - invalid items were skipped`);
}

export function assetRegistry(): AssetRegistry {
  const now = Date.now();
  if (cache && (!WATCH || now - cache.checkedAt < CHECK_EVERY_MS)) return cache.reg;
  const sig = WATCH ? signature(ASSETS_DIR) : "";
  if (cache && cache.sig === sig) {
    cache.checkedAt = now;
    return cache.reg;
  }
  const reg = importAssets(ASSETS_DIR);
  logIssues(reg);
  cache = { reg, sig, checkedAt: now };
  return reg;
}

/** Key of what a user can access; used for ETags so guests and users never share a cached body. */
export function accessKey(user: SessionUser | null): string {
  return user ? "u" : "g";
}

/** The library as a given user sees it: bodies only for groups they may use. */
export function libraryFor(user: SessionUser | null): AssetLibrary {
  const reg = assetRegistry();
  const assets: AssetDef[] = [];
  const patterns: PatternDef[] = [];
  const locked: CatalogItem[] = [];
  const groups: AssetLibrary["groups"] = [];
  for (const g of reg.groups) {
    const ok = canUseAccess(g.access, user);
    const listedAssets = g.assets.filter((a) => !a.hidden && !g.hidden);
    const listedPatterns = g.patterns.filter((p) => !p.hidden && !g.hidden);
    if (ok) {
      // Hidden items are still sent so existing maps render; the UI just doesn't list them.
      assets.push(...g.assets.map((a) => (g.hidden ? { ...a, hidden: true } : a)));
      patterns.push(...g.patterns.map((p) => (g.hidden ? { ...p, hidden: true } : p)));
    } else {
      for (const a of listedAssets) locked.push({ id: a.id, name: a.name, category: a.category, kind: "asset", group: g.id });
      for (const p of listedPatterns) locked.push({ id: p.id, name: p.name, category: "pattern", kind: "pattern", group: g.id });
    }
    if (g.hidden || (!listedAssets.length && !listedPatterns.length)) continue;
    groups.push({
      id: g.id,
      name: g.name,
      ...(g.description ? { description: g.description } : {}),
      access: g.access,
      order: g.order,
      locked: !ok,
      assetCount: listedAssets.length,
      patternCount: listedPatterns.length,
    });
  }
  return { version: reg.version, categories: reg.categories, groups, assets, patterns, locked };
}

/** Numbers + free items for public pages (home page). */
export function publicAssetSummary() {
  const guest = libraryFor(null);
  const user = libraryFor({ id: "summary", email: "", name: "" });
  const listed = (l: AssetLibrary) => l.assets.filter((a) => !a.hidden).length + l.patterns.filter((p) => !p.hidden).length;
  return {
    free: guest,
    freeCount: guest.assets.filter((a) => !a.hidden).length,
    /** Assets + textures an account adds on top of the free ones. */
    accountExtra: listed(user) - listed(guest),
  };
}
