# MapForge — TTRPG battle map creator

Vector-based map editor for D&D and other tabletop RPGs. Next.js 16 (React 19, App Router) + MongoDB (Mongoose, GridFS) + Tailwind CSS 4.

## Features

- **Home, Help (EN/PL), Log in / Sign up, My maps, My files, Editor** pages; language switch EN ⇄ PL (cookie `mf_lang`).
- **Guests**: up to 3 maps stored in the browser (IndexedDB), no uploads. **Users**: up to 20 maps stored in MongoDB, My files (500 images, 5 MB each, 200 MB total, 300 folders), plus the extended asset pack (36 assets + 6 textures) served only to logged-in users by `/api/assets/premium`.
- **New-map wizard**: page size in px (presets) → grid yes/no + cell size (70 px Roll20, 100 px Foundry, …, lines/dots) → name/background.
- **Editor**: SVG canvas (everything is vector), wheel zoom at cursor, pan (Space / middle mouse / H), drag & drop from the library or from the OS, click-to-add, Ctrl/Shift+click multi-select, marquee selection, move with grid snapping (Alt = free), resize/rotate handles for one or many items, scale buttons & `[ ]`, align/distribute, z-order, flip, lock, 5 layers (hide/lock), text, rectangle, ellipse, freehand/walls, D&D 5e measuring ruler, undo/redo (150 steps), copy/paste/duplicate, background colours & tiled textures, tintable tokens.
- **Page & grid settings**: change resolution any time — scale everything, or resize the canvas with a 9-point anchor.
- **Autosave**: debounced (~0.7 s, max 3 s) to IndexedDB (guest) or `PUT /api/maps/:id` (user) with optimistic concurrency (`revision`) → conflicts between tabs/devices are detected, not silently overwritten.
- **My files** (logged-in users only): real folder tree (nest up to 8 levels), create / rename / delete folders, rename files, multi-select (checkboxes, Ctrl/⌘/Shift-click, Ctrl+A), bulk move ("Move to…" tree picker or drag onto a folder / breadcrumb) and bulk delete, search across all folders. Available in the editor's left panel and on the full-width `/files` page.
- **Lazy loading**: the client never downloads the whole library. `GET /api/uploads?folder=<id|root>` lists one folder (editor and /files start with the root only); opening a folder shows a skeleton the first time, then the listing is kept in memory so re-entering is instant (changed folders are shown from memory and refreshed in the background). Images download only when their tile is on screen (`loading="lazy"`, placeholder until loaded). Maps render their images straight from `/api/uploads/:id`; `POST /api/uploads/lookup` fetches names/sizes only for images a map uses. Search runs on the server (`?q=`).
- **Archive upload**: ZIP, TAR and TAR.GZ (≤ 50 MB) are unpacked on the server and their directory structure is recreated in the open folder (merged with same-named folders, duplicate file names get " (2)"). Non-images are skipped and reported.
- **Validation** (server-side, authoritative): real type sniffed from bytes (extension fixed to match), image header parsed for dimensions (≤ 16384 px/side, ≤ 100 MP), SVG sanitised and DTD/entities rejected, names checked (length, forbidden/control/bidi characters, reserved names, case-insensitive uniqueness), archive entries with `..`, absolute or drive paths skipped, symlinks/encrypted/ZIP64 refused, CRC checked, hard caps on entries (1000), images per archive (300), unpacked bytes (100 MB) and per-entry output (zip-bomb safe), quotas checked before anything is written and partial writes rolled back, per-user serialisation of mutations, same-origin check on every mutation. Files are served with a sandboxing CSP, owner-only access.
- **Export**: PNG/JPEG at 0.5×–4×, SVG, and a `.json` project file (with embedded uploads) that can be imported again. Guests who sign up can import their browser maps to the account.

## Running locally

Requirements: Node.js 20+, MongoDB 6+ (local, Docker or Atlas).

```bash
npm install
cp .env.example .env.local      # then set MONGODB_URI and a long random JWT_SECRET
npm run dev                     # http://localhost:3000
```

Database settings: app data goes to `MONGODB_DB` (else the URI path, else `map-generator`); the MongoDB
user is authenticated against `?authSource=` in the URI, else `MONGODB_AUTH_SOURCE`, else `admin`.
If your MongoDB user was created inside the app database, add `?authSource=map-generator` to the URI.

MongoDB quick start with Docker: `docker run -d -p 27017:27017 --name mapforge-mongo mongo:7`

Production: `npm run build && npm start` (JWT_SECRET is required in production).

## Project structure

```
src/
  app/                    pages + API route handlers
    api/auth/*            register, login, logout, me   (bcrypt + HS256 JWT in httpOnly cookie)
    api/maps, maps/[id]   list/create, get/save(autosave)/delete  (20-map limit enforced server-side)
    api/uploads, [id]     file tree (GET), upload image/archive (POST), rename/delete one file
    api/uploads/move|delete  bulk move / delete of files + folders
    api/folders, [id]     create / rename / delete (recursive) folders
    files                 My files page
    api/assets/premium    extended asset pack (catalog only for guests)
    editor/[id]           editor page
  components/
    editor/               canvas, toolbar, panels, dialogs
    map/MapRenderer.tsx   single SVG renderer used by editor, thumbnails, home demo and export
  lib/
    assets/free.ts        free SVG assets (bundled)
    assets/premium.ts     premium SVG assets (server-only)
    editor/               zustand store, geometry, autosave & shortcuts hooks, export
    client/               API client, IndexedDB storage, file store (uploads.ts), session
    files: components/files/FileBrowser.tsx (shared browser) + FileDialogs.tsx (name / move dialogs)
    server/               db connection, models, auth, http helpers,
                          files.ts (folders, quotas, extraction, move, delete), archive.ts (zip/tar/tgz reader)
    fileNames.ts          name validation / sanitising shared by client + server
    uploadCheck.ts        image sniffing, header dimensions, SVG sanitising
    mapContent.ts         map defaults + strict sanitisation of untrusted map JSON
    limits.ts             all product limits in one place
    i18n/                 en.ts / pl.ts dictionaries (type-checked keys)
```

Adding assets: append an entry to `src/lib/assets/free.ts` or `premium.ts` (100×100 viewBox SVG body, default size in grid cells, target layer, optional `tintable` using `currentColor`).
