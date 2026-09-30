// Product limits shared by client and server. The server always re-checks them.

export const LIMITS = {
  // Guests keep their maps in the browser; uploading files requires an account.
  anonymous: {
    maxMaps: 3,
  },
  user: {
    maxMaps: 20,
    /** Max number of stored files (images) per user. */
    maxUploads: 500,
    /** Max size of one image. */
    maxUploadBytes: 5 * 1024 * 1024,
    /** Max total size of all stored files per user. */
    maxStorageBytes: 200 * 1024 * 1024,
  },
  files: {
    /** Max size of an uploaded archive (compressed). */
    maxArchiveBytes: 50 * 1024 * 1024,
    /** Max entries (files + directories, incl. skipped ones) an archive may list. */
    maxArchiveEntries: 1000,
    /** Max images extracted from one archive. */
    maxArchiveFiles: 300,
    /** Max total unpacked size read from one archive (zip-bomb guard). */
    maxArchiveUnpackedBytes: 100 * 1024 * 1024,
    maxFolders: 300,
    /** Root-level folders have depth 1. */
    maxFolderDepth: 8,
    maxNameLength: 100,
    /** Max files + folders in one move / delete request. */
    maxBatchItems: 1000,
    /** Largest accepted image side and pixel count (decompression-bomb guard). */
    maxImageSide: 16384,
    maxImagePixels: 100_000_000,
  },
  map: {
    minSize: 100,
    maxSize: 16384,
    maxElements: 5000,
    maxNameLength: 80,
    maxPayloadBytes: 4 * 1024 * 1024,
  },
} as const;

export const ALLOWED_UPLOAD_TYPES = [
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** Grid sizes commonly used by virtual tabletops. */
export const GRID_PRESETS = [
  { size: 50, label: "50 px" },
  { size: 70, label: "70 px (Roll20)" },
  { size: 100, label: "100 px (Foundry)" },
  { size: 140, label: "140 px" },
  { size: 200, label: "200 px" },
  { size: 256, label: "256 px (print / Dungeondraft)" },
];

export const DEFAULT_GRID_SIZE = 70;

export const PAGE_PRESETS = [
  { w: 1400, h: 1050, key: "small" },
  { w: 2100, h: 1400, key: "medium" },
  { w: 3500, h: 2800, key: "large" },
  { w: 1920, h: 1080, key: "hd" },
  { w: 3840, h: 2160, key: "uhd" },
  { w: 2480, h: 3508, key: "a4" },
] as const;

/** Feet represented by one grid cell (D&D 5e standard). */
export const FEET_PER_CELL = 5;

/**
 * Page size for a grid of `cols` × `rows` cells of `cell` px each.
 * `clamped` is true when the result had to be limited to the allowed page size,
 * i.e. the grid would no longer fill the page exactly.
 */
export function pageFromCells(cols: number, rows: number, cell: number) {
  const lim = (n: number) => Math.min(LIMITS.map.maxSize, Math.max(LIMITS.map.minSize, n));
  const rawW = Math.round(Math.max(1, Math.round(cols)) * cell);
  const rawH = Math.round(Math.max(1, Math.round(rows)) * cell);
  const w = lim(rawW);
  const h = lim(rawH);
  return { w, h, clamped: w !== rawW || h !== rawH };
}

/** Largest whole number of cells of `cell` px that fits on one side of a page. */
export const maxCells = (cell: number) => Math.max(1, Math.floor(LIMITS.map.maxSize / Math.max(1, cell)));
