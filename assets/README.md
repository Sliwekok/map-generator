# Built-in assets

Everything in the editor library (assets and background textures) comes from this folder.
One importer (`src/lib/assets/importer.ts`) scans it, validates every file and serves the
result through `GET /api/assets`. No code changes are needed to add assets.

```
assets/
  categories.json                      categories (id, name, default layer), in display order
  <group>/                             one folder = one group in the library
    group.json                         group settings + optional per-item metadata
    <category>/**/<id>.svg             assets; the first folder is the category
    patterns/**/<id>.svg               background textures
    <id>.svg                           loose files need "category" in group.json (or "defaultCategory")
  _drafts/                             folders / files starting with "_" or "." are ignored
```

Sub-folders inside a category or `patterns/` folder are allowed (up to 4 levels) just to keep
things tidy - they don't change anything.

## group.json

```json
{
  "name": { "en": "Dungeon pack", "pl": "Pakiet lochów" },
  "description": { "en": "Traps, doors, altars", "pl": "Pułapki, drzwi, ołtarze" },
  "access": "user",
  "order": 30,
  "hidden": false,
  "defaultCategory": "dungeon",
  "assets": {
    "spike-trap": { "name": { "en": "Spike trap", "pl": "Kolce" }, "cells": [1, 1], "tags": ["trap"] },
    "iron-door":  { "name": "Iron door", "cells": [1, 0.3], "layer": "objects" }
  },
  "patterns": {
    "flagstone": { "name": { "en": "Flagstone", "pl": "Płyty" } }
  }
}
```

| Key | Meaning |
| --- | --- |
| `name` | Group name, `{ "en", "pl" }` or one string for both. Defaults to the folder name. |
| `access` | `"free"` = everybody (guests too), `"user"` = logged-in users. Default `"free"`. The SVGs of a group are only ever sent to users who may use it; others see names with a lock. |
| `order` | Position in the library (lower first). Default 1000. |
| `hidden` | `true` = not listed in the library, but maps that already use its items still render. Use it to retire a group; deleting it would turn those items into "?". |
| `defaultCategory` | Category for SVGs placed directly in the group folder. |
| `assets` / `patterns` | Optional metadata keyed by id (= file name without `.svg`). The order here is the order in the library; files not listed follow alphabetically. |

Per-asset keys (all optional): `name`, `category` (overrides the folder), `cells` `[w, h]` default
size in grid cells (default `[1, 1]`), `layer` (`background`/`terrain`/`objects`/`tokens`/`labels`,
default: the category's `defaultLayer`), `tintable` (default: true when the SVG uses
`currentColor`), `defaultTint` (`#rrggbb`), `tags` (extra search words), `hidden`.
Per-texture keys: `name`, `hidden`. Without a name, one is made from the id (`dead-tree` → "Dead tree").

## Rules

- **Ids are global and permanent.** Maps store only the id, so never rename a file that is in use
  (hide it instead). An id is the file name: lower-case `a-z 0-9 - _`, unique across all groups
  (the first group by `order` wins a clash and the clash is reported as an error, which stops
  `npm run build`). A short per-group prefix (like `p-` in `extended/`) avoids clashes.
- SVG: one `<svg>` root with a `viewBox` (or numeric width/height), max 256 KB. Root presentation
  attributes (`fill="none"`, `stroke=…`) are kept. Internal ids (gradients, clip paths) are
  prefixed automatically so assets never clash.
- Rejected: `<script>`, `<style>`, `<foreignObject>`, animation elements, `on…=` handlers,
  external links / `url()` (only `#id` and embedded `data:image/...` are allowed), DOCTYPE/ENTITY.
- Textures need a square viewBox starting at `0 0`; they are tiled at grid size × texture scale.
- Tintable assets use `currentColor` for the recolourable part.

## Checking

```
npm run assets:check             # summary + problems, exit 1 on errors
npm run assets:check -- --list   # every group and item
npm run assets:check -- --strict # warnings fail too
```

It also runs before `npm run build`. The app itself never crashes on a bad file: invalid items
are skipped and reported in the server log. In development changes are picked up within ~2 s
(no restart); in production the folder is read once at start (restart after adding assets, or
set `ASSETS_WATCH=1`). `ASSETS_DIR` points the importer at a different folder.
