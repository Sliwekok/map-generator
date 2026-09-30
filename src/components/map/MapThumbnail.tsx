"use client";

import { MapRenderer } from "./MapRenderer";
import { useAssets } from "@/lib/client/assets";
import { useUploadMap } from "@/lib/client/uploads";
import type { MapContent } from "@/lib/types";

export default function MapThumbnail({ doc, id, className }: { doc: MapContent; id: string; className?: string }) {
  const assets = useAssets((s) => s.byId);
  const patterns = useAssets((s) => s.patternsById);
  const uploads = useUploadMap();
  return (
    <svg viewBox={`0 0 ${doc.width} ${doc.height}`} className={className} preserveAspectRatio="xMidYMid meet" role="img" aria-label={doc.name}>
      <MapRenderer
        doc={doc}
        idPrefix={`th-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`}
        showGrid
        assets={assets}
        patterns={patterns}
        uploads={uploads}
      />
    </svg>
  );
}
