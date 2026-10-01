"use client";

import { useCallback } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useAssets } from "@/lib/client/assets";
import { useUploads } from "@/lib/client/uploads";
import type { MapElement } from "@/lib/types";

export interface ItemLabel {
  /** Icon kind: "image" for uploaded images, otherwise the element type. */
  kind: string;
  /** What the item list shows: the user's name, or the default name. */
  name: string;
  /** Name shown when the item has no name of its own (placeholder of the rename field). */
  defaultName: string;
  custom: boolean;
}

/** Window event asking the item list to start renaming an item: detail = { id }. */
export const RENAME_EVENT = "mapforge:rename";
export const requestRename = (id: string) => window.dispatchEvent(new CustomEvent(RENAME_EVENT, { detail: { id } }));

/** Returns a function giving every element its display name (custom name or asset / file / text / type name). */
export function useItemLabel() {
  const { t, lang } = useI18n();
  const assets = useAssets((s) => s.byId);
  const uploads = useUploads((s) => s.byId);
  return useCallback(
    (e: MapElement): ItemLabel => {
      let kind: string = e.type;
      let defaultName: string;
      if (e.type === "asset") {
        if (e.assetId.startsWith("u:")) {
          kind = "image";
          defaultName = uploads[e.assetId.slice(2)]?.name ?? t("editor.layers.types.image");
        } else defaultName = assets[e.assetId]?.name[lang] ?? t("editor.layers.types.asset");
      } else if (e.type === "text") {
        defaultName = e.text.replace(/\s+/g, " ").trim() || t("editor.layers.types.text");
      } else defaultName = t(`editor.layers.types.${e.type}` as TKey);
      return { kind, name: e.name || defaultName, defaultName, custom: !!e.name };
    },
    [t, lang, assets, uploads],
  );
}
