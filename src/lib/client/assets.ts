// Client-side asset library: everything comes from GET /api/assets (built by the one importer,
// lib/assets/importer.ts). Groups the user can't use arrive as a body-less catalog (`locked`).
"use client";

import { create } from "zustand";
import type { AssetCategoryDef, AssetDef, AssetGroupInfo, AssetLibrary, CatalogItem, PatternDef, SessionUser } from "@/lib/types";
import { api } from "./api";

export type { CatalogItem };

interface AssetsState {
  status: "idle" | "loading" | "ready" | "error";
  version: string | null;
  categories: AssetCategoryDef[];
  groups: AssetGroupInfo[];
  /** Every usable asset / texture, including hidden ones (they still render on maps). */
  assets: AssetDef[];
  patterns: PatternDef[];
  byId: Record<string, AssetDef>;
  patternsById: Record<string, PatternDef>;
  locked: CatalogItem[];
  loadedFor: string | null;
  /** Loads the library for this user (no-op when already loaded for them). */
  load: (user: SessionUser | null, opts?: { force?: boolean }) => Promise<void>;
}

const idx = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x])) as Record<string, T>;

let inflight: { key: string; p: Promise<void> } | null = null;
let generation = 0;

export const useAssets = create<AssetsState>((set, get) => ({
  status: "idle",
  version: null,
  categories: [],
  groups: [],
  assets: [],
  patterns: [],
  byId: {},
  patternsById: {},
  locked: [],
  loadedFor: null,
  load(user, opts) {
    const key = user?.id ?? "anon";
    const s = get();
    if (!opts?.force && s.loadedFor === key && s.status === "ready") return Promise.resolve();
    if (inflight?.key === key) return inflight.p;
    const gen = ++generation;
    if (s.loadedFor !== key || s.status !== "ready") set({ status: "loading" });
    const p = api<AssetLibrary>("/api/assets")
      .then((lib) => {
        if (gen !== generation) return;
        set({
          status: "ready",
          version: lib.version,
          categories: lib.categories,
          groups: lib.groups,
          assets: lib.assets,
          patterns: lib.patterns,
          byId: idx(lib.assets),
          patternsById: idx(lib.patterns),
          locked: lib.locked,
          loadedFor: key,
        });
      })
      .catch(() => {
        // Keep whatever was loaded before (e.g. a brief network drop) - only flag the error.
        if (gen === generation) set({ status: get().loadedFor ? "ready" : "error" });
      })
      .finally(() => {
        if (inflight?.p === p) inflight = null;
      });
    inflight = { key, p };
    return p;
  },
}));

/** True while the library is still loading - renderers then skip unknown assets instead of drawing "?". */
export const useAssetsPending = () => useAssets((s) => s.status === "idle" || s.status === "loading");
