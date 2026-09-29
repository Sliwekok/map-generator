// Asset registry: free pack is bundled, extended pack is fetched for logged-in users.
"use client";

import { create } from "zustand";
import type { AssetDef, PatternDef, SessionUser } from "@/lib/types";
import { FREE_ASSETS, FREE_PATTERNS } from "@/lib/assets/free";
import { api } from "./api";

export interface CatalogItem {
  id: string;
  name: { en: string; pl: string };
  category: string;
  kind: "asset" | "pattern";
}

interface AssetsState {
  assets: AssetDef[];
  patterns: PatternDef[];
  byId: Record<string, AssetDef>;
  patternsById: Record<string, PatternDef>;
  catalog: CatalogItem[];
  premiumLoaded: boolean;
  premiumFor: string | null;
  loadPremium: (user: SessionUser | null) => Promise<void>;
}

const idx = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x])) as Record<string, T>;

export const useAssets = create<AssetsState>((set, get) => ({
  assets: FREE_ASSETS,
  patterns: FREE_PATTERNS,
  byId: idx(FREE_ASSETS),
  patternsById: idx(FREE_PATTERNS),
  catalog: [],
  premiumLoaded: false,
  premiumFor: null,
  async loadPremium(user) {
    const key = user?.id ?? "anon";
    if (get().premiumFor === key && get().premiumLoaded) return;
    try {
      const r = await api<{ assets: AssetDef[]; patterns: PatternDef[]; catalog: CatalogItem[] }>("/api/assets/premium");
      const assets = [...FREE_ASSETS, ...r.assets];
      const patterns = [...FREE_PATTERNS, ...r.patterns];
      set({
        assets,
        patterns,
        byId: idx(assets),
        patternsById: idx(patterns),
        catalog: r.catalog,
        premiumLoaded: true,
        premiumFor: key,
      });
    } catch {
      set({ premiumLoaded: true, premiumFor: key });
    }
  },
}));
