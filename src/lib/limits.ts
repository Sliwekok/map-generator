// Product limits shared by client and server. The server always re-checks them.

export const LIMITS = {
  anonymous: {
    maxMaps: 3,
    maxUploads: 10,
    maxUploadBytes: 2 * 1024 * 1024,
  },
  user: {
    maxMaps: 20,
    maxUploads: 60,
    maxUploadBytes: 5 * 1024 * 1024,
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
