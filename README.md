# MapForge — TTRPG battle map creator

Vector-based map editor for D&D and other tabletop RPGs. Next.js 16 (React 19, App Router) + MongoDB (Mongoose, GridFS) + Tailwind CSS 4.

## Features

- **Home, Help (EN/PL), Log in / Sign up, My maps, Editor** pages; language switch EN ⇄ PL (cookie `mf_lang`).
- **Guests**: up to 3 maps + 10 uploads stored in the browser (IndexedDB). **Users**: up to 20 maps + 60 uploads stored in MongoDB, plus the extended asset pack (36 assets + 6 textures) served only to logged-in users by `/api/assets/premium`.
- **New-map wizard**: page size in px (presets) → grid yes/no + cell size (70 px Roll20, 100 px Foundry, …, lines/dots) → name/background.
- **Editor**: SVG canvas (everything is vector), wheel zoom at cursor, pan (Space / middle mouse / H), drag & drop from the library or from the OS, click-to-add, Ctrl/Shift+click multi-select, marquee selection, move with grid snapping (Alt = free), resize/rotate handles for one or many items, scale buttons & `[ ]`, align/distribute, z-order, flip, lock, 5 layers (hide/lock), text, rectangle, ellipse, freehand/walls, D&D 5e measuring ruler, undo/redo (150 steps), copy/paste/duplicate, background colours & tiled textures, tintable tokens.
- **Page & grid settings**: change resolution any time — scale everything, or resize the canvas with a 9-point anchor.
- **Autosave**: debounced (~0.7 s, max 3 s) to IndexedDB (guest) or `PUT /api/maps/:id` (user) with optimistic concurrency (`revision`) → conflicts between tabs/devices are detected, not silently overwritten.
- **Uploads**: PNG/JPG/WEBP/GIF/SVG, type sniffed from bytes, SVG sanitised, served with a sandboxing CSP, owner-only access.
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
    api/uploads, [id]     GridFS uploads
    api/assets/premium    extended asset pack (catalog only for guests)
    editor/[id]           editor page
  components/
    editor/               canvas, toolbar, panels, dialogs
    map/MapRenderer.tsx   single SVG renderer used by editor, thumbnails, home demo and export
  lib/
    assets/free.ts        free SVG assets (bundled)
    assets/premium.ts     premium SVG assets (server-only)
    editor/               zustand store, geometry, autosave & shortcuts hooks, export
    client/               API client, IndexedDB storage, uploads, session
    server/               db connection, models, auth, http helpers
    mapContent.ts         map defaults + strict sanitisation of untrusted map JSON
    limits.ts             all product limits in one place
    i18n/                 en.ts / pl.ts dictionaries (type-checked keys)
```

Adding assets: append an entry to `src/lib/assets/free.ts` or `premium.ts` (100×100 viewBox SVG body, default size in grid cells, target layer, optional `tintable` using `currentColor`).
