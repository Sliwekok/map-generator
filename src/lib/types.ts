// Shared types used by both the client (editor) and the server (API / DB).

export type LayerId = "background" | "terrain" | "objects" | "tokens" | "labels";

export const LAYER_ORDER: LayerId[] = ["background", "terrain", "objects", "tokens", "labels"];

export interface LayerState {
  id: LayerId;
  visible: boolean;
  locked: boolean;
}

export type GridStyle = "lines" | "dots";

export interface GridSettings {
  enabled: boolean;
  size: number; // cell size in px
  color: string;
  opacity: number; // 0..1
  lineWidth: number; // px (in map space)
  style: GridStyle;
}

export interface BackgroundSettings {
  color: string;
  pattern: string | null; // pattern id from the asset library, tiled at grid size
  patternScale: number; // multiplier of grid size for one pattern tile
}

interface ElementBase {
  id: string;
  x: number; // top-left of the un-rotated box, map px
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees, around box center
  opacity: number; // 0..1
  layer: LayerId;
  locked?: boolean;
  flipX?: boolean;
  flipY?: boolean;
}

export interface AssetElement extends ElementBase {
  type: "asset";
  assetId: string; // built-in id, or "u:<uploadId>" for user uploads
  tint?: string; // replaces currentColor in tintable assets
}

export interface ShapeElement extends ElementBase {
  type: "rect" | "ellipse";
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  radius?: number; // rect corner radius
}

export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  fontSize: number;
  color: string;
  fontFamily: "serif" | "sans" | "mono" | "fantasy";
  bold?: boolean;
  italic?: boolean;
  outline?: string | null; // halo/outline color for readability on busy maps
}

export interface PathElement extends ElementBase {
  type: "path";
  // points in element-local px (0..width, 0..height)
  points: [number, number][];
  stroke: string;
  strokeWidth: number;
  closed?: boolean;
  fill?: string | null;
}

export type MapElement = AssetElement | ShapeElement | TextElement | PathElement;
export type ElementType = MapElement["type"];

/** The editable content of a map (what autosave persists). */
export interface MapContent {
  name: string;
  width: number;
  height: number;
  background: BackgroundSettings;
  grid: GridSettings;
  layers: LayerState[];
  elements: MapElement[];
}

export type MapSource = "local" | "cloud";

export interface MapDoc extends MapContent {
  id: string;
  source: MapSource;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface MapSummary {
  id: string;
  source: MapSource;
  name: string;
  width: number;
  height: number;
  updatedAt: string;
}

export interface UploadInfo {
  id: string; // "u:<id>" form is used in elements; this is the raw id
  name: string;
  contentType: string;
  width: number;
  height: number;
  size: number;
  source: MapSource;
  url: string; // usable in <image href>
  folderId: string | null; // null = root folder
  createdAt: string;
}

export interface FolderInfo {
  id: string;
  name: string;
  parentId: string | null; // null = root folder
  createdAt: string;
  /** Number of direct children (folders + files); sent with folder listings. */
  itemCount?: number;
}

/** Contents of one folder, as returned by GET /api/uploads?folder=… */
export interface FolderListing {
  folder: FolderInfo | null; // null = root
  path: FolderInfo[]; // ancestors from the top, excluding `folder`
  folders: FolderInfo[]; // direct subfolders (with itemCount)
  uploads: UploadInfo[]; // files directly in the folder
  usage: StorageUsage;
}

/** Search results; `known` holds every ancestor folder so paths can be shown. */
export interface FileSearchResult {
  folders: FolderInfo[];
  uploads: UploadInfo[];
  known: FolderInfo[];
  truncated: boolean;
}

export interface StorageUsage {
  files: number;
  bytes: number;
  folders: number;
}

/** One file or folder that was not taken from an upload / archive, with the reason. */
export interface SkippedEntry {
  path: string;
  reason:
    | "not_image"
    | "bad_type"
    | "corrupt"
    | "too_large"
    | "dimensions"
    | "unsafe_svg"
    | "unsafe_path"
    | "too_deep"
    | "encrypted"
    | "compression"
    | "link"
    | "special"
    | "too_many_files";
}

export interface UploadResult {
  uploads: UploadInfo[];
  folders: FolderInfo[];
  skipped: SkippedEntry[];
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Who may use an asset group. Ordered from most to least open; `canUseAccess()` in
 * lib/assets/access.ts decides per user. Add a level here (e.g. "premium") to introduce a new tier.
 */
export type AssetAccess = "free" | "user";
export const ASSET_ACCESS_LEVELS: AssetAccess[] = ["free", "user"];

export type I18nText = { en: string; pl: string };

/** Asset category (assets/categories.json). */
export interface AssetCategoryDef {
  id: string;
  name: I18nText;
  defaultLayer: LayerId;
}
/** Category id from assets/categories.json. */
export type AssetCategory = string;

export interface AssetDef {
  id: string;
  name: I18nText;
  category: AssetCategory;
  group: string; // asset group (folder in assets/)
  viewBox: string; // e.g. "0 0 100 100"
  body: string; // inner SVG markup (validated by the importer, built-in only)
  cells: [number, number]; // default size in grid cells
  layer: LayerId;
  tintable?: boolean; // uses currentColor
  defaultTint?: string;
  tags?: string[]; // extra search words
  hidden?: boolean; // still renders on existing maps, not listed in the library
  premium?: boolean; // group access is not "free"
}

export interface PatternDef {
  id: string;
  name: I18nText;
  group: string;
  size: number; // tile size in its own units (viewBox is 0 0 size size)
  body: string;
  hidden?: boolean;
  premium?: boolean;
}

/** One asset group as the client sees it. */
export interface AssetGroupInfo {
  id: string;
  name: I18nText;
  description?: I18nText;
  access: AssetAccess;
  order: number;
  /** The current user may not use this group - only its body-less catalog is sent. */
  locked: boolean;
  assetCount: number; // listed (non-hidden) assets
  patternCount: number;
}

/** Body-less entry of a locked group, so the UI can show what an account unlocks. */
export interface CatalogItem {
  id: string;
  name: I18nText;
  category: string; // asset category, or "pattern"
  kind: "asset" | "pattern";
  group: string;
}

/** GET /api/assets */
export interface AssetLibrary {
  version: string;
  categories: AssetCategoryDef[];
  groups: AssetGroupInfo[];
  assets: AssetDef[];
  patterns: PatternDef[];
  locked: CatalogItem[];
}
