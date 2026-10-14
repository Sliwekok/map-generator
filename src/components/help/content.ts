import { LIMITS } from "@/lib/limits";

export type Block = string | { list: string[] } | { keys: [string, string][] } | { tip: string };
export interface HelpSection {
  id: string;
  title: string;
  blocks: Block[];
}

const A = LIMITS.anonymous;
const U = LIMITS.user;
const F = LIMITS.files;
const M = LIMITS.map;
const mb = (n: number) => `${n / 1024 / 1024} MB`;

export const HELP_EN: HelpSection[] = [
  {
    id: "start",
    title: "Getting started",
    blocks: [
      "MapForge is a browser-based editor for battle maps used in Dungeons & Dragons and other tabletop RPGs. Everything you place on a map is a vector (SVG), so maps stay sharp at any zoom level and export resolution.",
      {
        list: [
          `Guests (no account): up to ${A.maxMaps} maps, saved in this browser (IndexedDB), and the free packs (Basic pack and Floors). Uploading your own files requires an account.`,
          `Logged-in users (free account): up to ${U.maxMaps} maps saved in the cloud (available on every device), the Extended pack, Floors+ and Tavern & Houses packs, and My files: up to ${U.maxUploads} images (max ${mb(U.maxUploadBytes)} each, ${mb(U.maxStorageBytes)} in total) organised in folders.`,
          "After signing in you can import the maps you created as a guest into your account from the “My maps” page.",
          "The interface is available in English and Polish — switch the language on the Settings page (sliders icon).",
        ],
      },
      { tip: "Guest maps live only in the browser you used. Clearing site data or using private mode removes them — create an account to keep your work safe." },
    ],
  },
  {
    id: "create",
    title: "Creating a map",
    blocks: [
      "Open “My maps” and click “New map”. The wizard asks three things:",
      {
        list: [
          "Page size — first choose “Size by”. Pixels: type the width and height or pick a preset (Small, Medium, Large, Full HD, 4K, A4 @300dpi). Grid cells: enter the number of columns and rows and the cell size, and the page size is calculated for you (the grid is switched on). You can swap the orientation with ⇄.",
          "Grid — decide whether you need a grid. If yes, pick the cell size: 50, 70 (Roll20 standard), 100 (Foundry VTT default), 140, 200 or 256 px (print / Dungeondraft), or type any size. Choose lines or dots and a colour. The wizard shows how many cells your page will have.",
          "Details — a name and the background colour.",
        ],
      },
      "A live preview next to every step shows the page with its size in pixels and cells.",
      `Page sides can be ${M.minSize}–${M.maxSize} px. If a cell-based size would go beyond that, the wizard warns you that the grid won't fill the page exactly.`,
      "All of this can be changed later in the editor, so don't worry about getting it perfect.",
    ],
  },
  {
    id: "maps",
    title: "Managing your maps",
    blocks: [
      {
        list: [
          "“My maps” shows a thumbnail of each map, where it is stored (this browser or your account) and when it was last changed. Use Open, Rename, Duplicate and Delete on each card.",
          "The counter at the top shows how many of your maps you have used. When you reach the limit, delete a map you no longer need (or log in, if you are a guest).",
          "“Import project file” opens a .json project exported from MapForge as a new map. When you are logged in, the images saved in the project are added to My files; guests get the map without those images.",
          "After logging in, maps you made as a guest in this browser are listed under “Maps from this browser”. “Import to account” moves them to the cloud.",
        ],
      },
    ],
  },
  {
    id: "layout",
    title: "The editor at a glance",
    blocks: [
      {
        list: [
          "Top bar — back to My maps, the map name (click it to rename the map), tools, undo/redo, zoom (click the percentage for 100%), grid & snap toggles, Page & grid, save status, Export, and Help and Settings (both open in a new tab).",
          "Left panel — Library (built-in assets), My files (your uploads) and Background (colour and textures).",
          "Canvas — your map. The dark area around it is outside the page and is not exported.",
          "Right panel — properties of the selected items. With nothing selected it shows the Map panel (grid settings, and an Unlock button when some items are locked). Below are the layers and the “All items” list. While the Brush or Eraser is active, the right panel shows the brush settings instead.",
          "Status bar — page size, cursor position in pixels and grid cells, zoom and element count.",
        ],
      },
    ],
  },
  {
    id: "assets",
    title: "Adding assets",
    blocks: [
      "Drag any asset from the Library onto the map, or simply click it to place it in the centre of the view. Assets get a sensible size measured in grid cells (a tree is 2 × 2 cells, a token 1 × 1) and are placed on a matching layer automatically.",
      {
        list: [
          "Filter the library by category (Terrain, Nature, Structures, Dungeon, Furniture, Tokens, Markers) or search — the search matches English and Polish names and tags across all packs.",
          "Tokens, markers, rugs, bed covers and some other assets are tintable — change their colour in the Properties panel (Reset brings back the default).",
          "The library is split into groups (packs) — click a group's name to fold it away; MapForge remembers which groups you folded. Groups with a lock, and assets marked ★, need a free account; guests see their names so they know what they would unlock.",
          "Background textures are chosen in the Background tab, grouped by pack like the library, and tile at the grid size; adjust them with the texture scale slider, or pick None to use only the colour.",
        ],
      },
      {
        list: [
          "Basic pack (free) — trees, rocks, walls, doors, a house, furniture, tokens, markers and grass, cobblestone and parchment textures.",
          "Floors (free) — flagstone, stone blocks, cave floor, dirt, gravel and old planks.",
          "Extended pack (account) — lava, rivers, bridges, cliffs, ruins, towers, dungeon dressing, more tokens and markers, plus wood, water, sand, dungeon, snow and volcanic rock textures.",
          "Floors+ (account) — herringbone, marble, hex tiles, temple mosaic, ruined flagstones, sewer slabs, mossy and crystal caves, cracked earth, swamp mud, forest floor, parquet and ice.",
          "Tavern & Houses (account) — a tavern, cottage and townhouse with roofs, wall pieces, posts, doors, windows and stairs, a full tavern interior (bar, kegs, tables, beds, kitchen and more) and plank, flagstone, rushes and parquet textures.",
        ],
      },
      { tip: "Tavern & Houses walls, posts, doors and windows all have the same thickness, so they line up when snapped to the grid." },
    ],
  },
  {
    id: "uploads",
    title: "My files: your own images, folders and archives",
    blocks: [
      "Uploading your own images requires an account. Open My files in the editor's left panel, or the full-size My files page from the top menu. Supported images: PNG, JPG, WEBP, GIF and SVG. SVG files stay vectors; raster images keep their original resolution.",
      {
        list: [
          `Click “Upload” or drop files onto the file browser — they go into the folder that is open. Dropping an image on the map uploads it to the open folder and places it where you dropped it.`,
          `Archives (ZIP, TAR, TAR.GZ, up to ${mb(F.maxArchiveBytes)}) are unpacked on upload: the folders inside the archive are recreated in the open folder (merged with folders of the same name) and every supported image is added. Other files are skipped and listed after the upload.`,
          "After an upload, a short report shows how many files and folders were added and lists anything that was skipped or not uploaded, with the reason.",
          "Create folders with “New folder”; nest them up to " + F.maxFolderDepth + " levels deep. Rename files and folders with the pencil icon (or F2).",
          "“Search all files…” looks through every folder by name. The usage bar shows how many files and how much storage you have used.",
          "Select several items with the checkboxes, Ctrl/⌘ + click or Shift + click (Ctrl/⌘ + A selects everything in the folder). Move them with “Move to…” or by dragging them onto a folder or a breadcrumb; delete them with the Delete key. Deleting a folder deletes everything inside it.",
          "Click an image in the editor panel to add it to the centre of the view, or drag it (or several selected images) onto the map.",
          "Large images (for example a hand-drawn map) are fitted to the page and put on the Background layer; smaller ones become objects. Deleting a file removes it from every map that uses it.",
        ],
      },
      {
        tip: `Limits: ${U.maxUploads} images, ${mb(U.maxUploadBytes)} per image (max ${F.maxImageSide} px per side), ${mb(U.maxStorageBytes)} in total, ${F.maxFolders} folders, ${F.maxArchiveFiles} images per archive. Every file is checked on the server: the real format is detected from its content (not its name), damaged or oversized images are rejected, SVGs are cleaned of scripts, and archive entries that try to escape their folder are ignored.`,
      },
    ],
  },
  {
    id: "select",
    title: "Selecting items",
    blocks: [
      {
        list: [
          "Click an item to select it.",
          "Hold Ctrl (⌘ on Mac) or Shift and click to add or remove items from the selection — this is how you pick many items at once.",
          "Drag on an empty part of the map to draw a selection box. Hold Ctrl while dragging to add to the current selection.",
          "Ctrl+A selects everything on visible, unlocked layers. Clicking a layer name selects everything on that layer (including locked items).",
          "Esc clears the selection.",
        ],
      },
      "Everything you do next — moving, scaling, rotating, recolouring, changing layer, deleting — applies to the whole selection.",
    ],
  },
  {
    id: "transform",
    title: "Moving, scaling and rotating",
    blocks: [
      {
        list: [
          "Move — drag the selection. With snapping on (magnet icon, key S) items align to the grid; hold Alt to move freely. Arrow keys nudge by 1 px, Shift+arrows by one cell.",
          "Resize — drag the square handles. Corner handles keep proportions; hold Shift for free resizing. Side handles stretch in one direction.",
          "Rotate — drag the round handle above the selection. It snaps in 15° steps (hold Alt for free rotation). Keys Q / E rotate by 15°, Shift+Q / Shift+E by 90°.",
          "Scale — use the 50% / 90% / 110% / 200% buttons, type any percentage, or press [ and ] to shrink or grow by 10%. Works for any number of selected items.",
          "Flip, lock, snap-to-grid and z-order (bring to front / send to back) are in the Properties panel.",
          "Right-click an item for a quick menu: cut, copy, paste, duplicate, rename (or edit text), move to another layer, change the order, Transform (rotate 90°, enlarge or shrink 10%, flip), snap to grid, lock/unlock and delete. Right-clicking a locked item still lets you unlock it; right-clicking empty space offers “Paste here”, “Select all”, “Fit map to screen” and the grid and snapping toggles.",
          "With two or more items selected you can align them (left, centre, right, top, middle, bottom) and with three or more distribute them evenly.",
        ],
      },
    ],
  },
  {
    id: "tools",
    title: "Drawing tools",
    blocks: [
      {
        list: [
          "Text (T) — click an empty spot to place a label, then type. Double-click an existing label to edit it (with the Text tool active, a single click on it is enough). Font (Serif, Sans, Mono, Fantasy), size, bold, italic, colour and a readability halo are in Properties.",
          "Rectangle (R) and Ellipse (O) — drag to draw areas such as rooms, lakes or zones of effect. Shift draws a square/circle. Fill, fill opacity, outline, outline width and (for rectangles) corner radius are in Properties.",
          "Freehand / walls (P) — draw thin lines such as cave walls or borders. Hold Shift for a straight line. Tick “Closed shape” in Properties to close a path and fill it.",
          "Brush (B) and Eraser (X) — paint rivers, roads, paths and terrain by hand with a colour or a texture. See “Painting with the brush” below.",
          "Measure (M) — drag to measure a distance. MapForge uses the D&D 5e rule (diagonals count as one cell) and 5 ft per cell.",
          "Pan (H) — drag to move the view. You can also hold Space or the middle mouse button with any tool.",
        ],
      },
    ],
  },
  {
    id: "painting",
    title: "Painting with the brush",
    blocks: [
      "The Brush (B) paints by hand — rivers, streams, roads, dirt paths, lava flows, patches of sand, grass or snow, trails, fences, railways and cliffs — or scatters trees and rocks along a stroke. Pick the Brush in the toolbar; its settings appear in the right panel. The switch at the top chooses Paint or Scatter.",
      {
        list: [
          "Presets — one click sets up a brush. Areas & paths: River, Stream, Road, Dirt path, Lava, Sand, Grass, Snow, Wall. Lines: Trail, Footpath, Old road, Railway, Fence, Cliff. Rough edges: Coast, Pond, Cave wall, Rubble. Presets whose texture is in the extended pack paint with colour for guests (marked with a lock).",
          "Line style — Solid (a painted band), Dashed or Dotted (trails, footpaths), Double (two parallel lines with an open middle, like roads on old maps), Railway (rails over cross-ties), Fence (a line with posts) or Cliff (a line with hatching on one side — tick “Hatching on the other side” to swap it). Spacing sets the gaps between dashes, dots, ties, posts or hatches; Railway and Fence have a second colour for the ties / posts. Railway, Fence and Cliff are drawn in colour only.",
          "Rough edge (solid strokes) — a jagged, organic outline instead of a smooth one: low values for coastlines and ponds, high values for cave walls and rubble. It works with textures, the edge outline and soft edges.",
          "Paint — a colour, a texture from the library, or an image from My files (logged-in users; it repeats as square tiles). The base colour shows under the texture and is used whenever the texture can't be shown. Textures are anchored to the map, so strokes that touch continue the same pattern.",
          "Size is set in grid cells, so a brush fits any map. [ and ] make it smaller or bigger while painting; the outline under the pointer shows the size.",
          "Soft edges feather the stroke for natural blending, Smoothing evens out a shaky hand, and Edge adds an outline along the stroke — river banks, road kerbs, a lava crust.",
          "Paint on layer decides where strokes go (Terrain by default, so objects and tokens stay on top).",
          "Join matching strokes — a stroke that starts on paint of the same brush becomes part of it, so forks, junctions and crossings have no seams or doubled edges.",
          "Shift + drag draws a straight line; Shift + click draws a straight line from where the previous stroke ended (with snapping on, the end snaps to the grid).",
        ],
      },
      "The Eraser (X) removes paint from brush strokes on visible, unlocked layers — drag across a river to make a ford, or tidy an edge. A stroke erased completely is removed. Erasing is kept inside the stroke, so it can be undone with Ctrl+Z or later with “Restore erased parts”.",
      "The Eraser also works on uploaded images and library graphics: select the graphic first (V), then press X (or use “Erase parts” in its properties or right-click menu). While a graphic is selected the eraser only touches the selection — brush strokes and other items stay as they are. Switch the mode to Restore (or hold Alt for one stroke) to paint erased parts back, and use Softness for a feathered edge that blends the image into the map. Erasing never changes the original file: it is kept with the item, follows it when you move, rotate, flip or resize it, and “Show erased parts again” brings the whole graphic back.",
      "Every painted stroke is a normal item: select it to move, rotate, scale, change its layer, or restyle it (size, line style, rough edge, paint, texture scale, softness, edge). “Paint with this brush” copies a stroke's look back into the brush.",
      "Scatter drops library graphics along the stroke — a forest edge, rocks along a cliff, grass tufts, crates in a yard. Pick a preset (Forest, Pines, Bushes, Grass tufts, Rocks, Deadwood, Mushrooms, Desert, Clutter) or choose up to 12 graphics yourself; only packs you can use are offered. Size scales the graphics, Size variation mixes big and small ones, Spacing sets the gaps (100% = about touching), Spread scatters them across the stroke, and Rotation is Random, Follow (along the stroke) or None. “Each graphic's own layer” puts trees on Objects and grass on Terrain, or pick one layer for all.",
      "Every scattered graphic is a normal item you can move, recolour, erase parts of or delete. One Ctrl+Z undoes the whole stroke. [ and ] change their size.",
      { tip: "Paint rivers and roads on the Terrain layer, then place bridges and trees from the library on the Objects layer above them — or scatter a forest along the river bank with one stroke." },
    ],
  },
  {
    id: "layers",
    title: "Layers",
    blocks: [
      "Every item belongs to one of five layers, drawn from bottom to top: Background, Terrain, Objects, Tokens and Labels. Use the eye icon to hide a layer and the lock icon to protect it from accidental changes — locked layers can't be selected on the canvas, so you can draw selection boxes over them freely.",
      "Change an item's layer in the Properties panel. Individual items can be locked too (key L); unlock them via “Select all on layer” or the Unlock button shown in the Map panel when nothing is selected.",
      "“All items” (under the layers) lists every item on the map. Click a row to select the item and centre the view on it (Ctrl/Shift + click adds it to the selection), use the trash icon to delete it, or right-click it for Rename, Restore default name, Lock/Unlock and Delete — this also works for items on hidden layers. Icons on a row show when the item or its layer is locked or hidden.",
      "Give items your own names (e.g. “Secret door”, “Boss lair”): double-click an item on the map or in “All items”, right-click it and choose “Rename”, press F2, or type in the Name field of the Properties panel. Clear the name to go back to the default one. Names are only shown in the editor, never on the exported image.",
    ],
  },
  {
    id: "view",
    title: "Zooming and navigation",
    blocks: [
      {
        list: [
          "Mouse wheel zooms around the cursor (pinch on a trackpad). Shift+wheel scrolls sideways.",
          "+ / − zoom in and out, 0 (or Ctrl+0) fits the map to the screen, 1 shows it at 100%. The zoom buttons in the top bar do the same; clicking the percentage jumps to 100%.",
          "Hold Space and drag, drag with the middle mouse button, or use the Pan tool to move around.",
          "G shows or hides the grid, S toggles snapping.",
        ],
      },
    ],
  },
  {
    id: "resolution",
    title: "Page size and resolution",
    blocks: [
      "Open “Page & grid” (gear icon) to change the page size at any time. Size by Pixels — use the presets, ½× / 2× quick buttons, or type exact values (with or without keeping the aspect ratio) — or by Grid cells — set columns, rows and the cell size (⇄ swaps columns and rows). The dialog shows how many cells the new page will have. Two modes are available:",
      {
        list: [
          "Scale everything — the whole map, including the grid, is scaled to the new size. Perfect for producing a higher resolution version of the same map.",
          "Resize canvas — content keeps its size and the page grows or shrinks around it. Pick an anchor to decide which side is extended.",
        ],
      },
      "Because all assets are vectors, scaling up does not lose quality. Grid size, style, colour, opacity and line width are also edited here or in the map properties panel.",
    ],
  },
  {
    id: "saving",
    title: "Saving",
    blocks: [
      "There is no save button — every change is stored automatically less than a second after you stop editing (and at least every few seconds while you keep working). The indicator in the top bar shows where the map is saved (cloud icon: your account, laptop icon: this browser) and its state: saved, saving, unsaved, offline or an error. When saving fails or you go offline, MapForge retries automatically. Ctrl+S or a click on the indicator saves immediately.",
      "If the same map is edited in two tabs or on two devices, the indicator shows “Changed elsewhere” and you choose: “Load their version” or “Keep mine (overwrite)”, so nothing is overwritten silently.",
      "Undo (Ctrl+Z) and redo (Ctrl+Shift+Z or Ctrl+Y) remember up to 150 steps during the session.",
    ],
  },
  {
    id: "export",
    title: "Export and import",
    blocks: [
      {
        list: [
          "PNG / JPEG / WebP — choose a resolution of 0.5×, 1×, 2×, 3× or 4×; the dialog shows the output size. A 1400 × 1050 map exported at 2× is 2800 × 2100 px and stays crisp. You can include or hide the grid (most VTTs draw their own grid). The file name gets the scale, e.g. “Crypt@2x.png”.",
          "WebP — much smaller files than PNG at similar quality, handy for sharing and VTT uploads. Some browsers (e.g. Safari) can't save WebP — you'll see a message; choose PNG or JPEG there.",
          "Project file (.json) — a complete backup including your uploaded images. Import it with “Import project file” on the “My maps” page on any computer or account.",
        ],
      },
      { tip: "Using a VTT? Set its grid size to your cell size × export scale — e.g. 70 px cells exported at 1× for Roll20, or 100 px at 1× for Foundry." },
    ],
  },
  {
    id: "settings",
    title: "Settings and language",
    blocks: [
      "Open Settings with the sliders icon in the top menu or in the editor's top bar. It works for guests and logged-in users.",
      {
        list: [
          "Language — English or Polish, for the whole interface. The choice is saved in this browser and applied at once to every open MapForge tab.",
          "Account — shows who you are signed in as, or reminds you that guest maps live only in this browser.",
        ],
      },
    ],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    blocks: [
      {
        keys: [
          ["V / H / T / R / O / P / M", "Select / Pan / Text / Rectangle / Ellipse / Freehand / Measure"],
          ["B / X", "Brush / Eraser"],
          ["Ctrl + click, Shift + click", "Add / remove item from selection"],
          ["Ctrl + A", "Select all"],
          ["Esc", "Clear selection, back to Select tool"],
          ["Delete / Backspace", "Delete selection"],
          ["Ctrl + C / X / V", "Copy / cut / paste"],
          ["Ctrl + D", "Duplicate"],
          ["Ctrl + Z / Ctrl + Shift + Z, Ctrl + Y", "Undo / redo"],
          ["Arrows / Shift + arrows", "Nudge 1 px / one cell"],
          ["[ / ]", "Scale selection −10% / +10% (with the brush or eraser: smaller / bigger brush)"],
          ["Shift + drag, Shift + click", "Brush: straight line / line from the end of the previous stroke"],
          ["Alt + drag", "Eraser on a selected image / graphic: switch erase ↔ restore for one stroke"],
          ["Q / E (Shift)", "Rotate −15° / +15° (90°)"],
          ["PgUp / PgDn / Home / End", "Forward / backward / to back / to front"],
          ["L", "Lock / unlock selection"],
          ["F2, double-click", "Rename the selected item (double-click on text edits the text)"],
          ["G / S", "Toggle grid / snapping"],
          ["Alt (while dragging)", "Temporarily disable snapping"],
          ["Space + drag, middle mouse", "Pan"],
          ["Wheel, + / −, 0 or Ctrl + 0, 1", "Zoom, fit to screen, 100%"],
          ["Ctrl + S", "Save now"],
          ["Enter / Esc", "While renaming: save / cancel"],
        ],
      },
    ],
  },
  {
    id: "faq",
    title: "Troubleshooting",
    blocks: [
      {
        list: [
          "“You reached the limit” — delete a map you no longer need, or log in to raise the limit.",
          "An asset shows as a red question mark — it comes from a group that needs an account (log in to see it) or refers to a file that was deleted.",
          "I can't click an item — its layer or the item itself is probably locked. Check the lock icons in the Layers panel.",
          "Export is too large — browsers can't create images wider or taller than 16384 px. Use a smaller scale.",
          "“Your browser can't save this format” — your browser can't encode WebP (Safari, for example). Choose PNG or JPEG, or use another browser.",
          "The brush doesn't paint — the layer in “Paint on layer” is locked or hidden. Unlock or show it, or pick another layer.",
          "The save status says “Offline” or “Save failed” — your changes are kept and MapForge saves them as soon as the connection is back. Avoid closing the tab until it shows “All changes saved”.",
          "The library says it couldn't load the assets — click “Try again”; if it keeps failing, reload the page.",
          "An upload was refused — the report after the upload gives the reason (for example unsupported format, too large, damaged or unsafe SVG). Check the limits in the My files section above.",
        ],
      },
    ],
  },
];

export const HELP_PL: HelpSection[] = [
  {
    id: "start",
    title: "Pierwsze kroki",
    blocks: [
      "MapForge to działający w przeglądarce edytor map bitewnych do Dungeons & Dragons i innych gier fabularnych. Wszystko, co umieszczasz na mapie, jest wektorem (SVG), więc mapy pozostają ostre przy każdym przybliżeniu i rozdzielczości eksportu.",
      {
        list: [
          `Goście (bez konta): do ${A.maxMaps} map zapisanych w tej przeglądarce (IndexedDB) i darmowe pakiety (Pakiet podstawowy i Podłogi). Wgrywanie własnych plików wymaga konta.`,
          `Zalogowani (darmowe konto): do ${U.maxMaps} map zapisanych w chmurze (dostępnych na każdym urządzeniu), pakiety Pakiet rozszerzony, Podłogi+ oraz Karczma i domy, a także Moje pliki: do ${U.maxUploads} obrazów (maks. ${mb(U.maxUploadBytes)} każdy, łącznie ${mb(U.maxStorageBytes)}) w folderach.`,
          "Po zalogowaniu możesz zaimportować mapy utworzone jako gość na swoje konto — na stronie „Moje mapy”.",
          "Interfejs jest dostępny po polsku i po angielsku — język zmienisz na stronie Ustawienia (ikona suwaków).",
        ],
      },
      { tip: "Mapy gościa istnieją tylko w przeglądarce, której użyto. Wyczyszczenie danych witryny lub tryb prywatny je usuwa — załóż konto, aby Twoja praca była bezpieczna." },
    ],
  },
  {
    id: "create",
    title: "Tworzenie mapy",
    blocks: [
      "Otwórz „Moje mapy” i kliknij „Nowa mapa”. Kreator zapyta o trzy rzeczy:",
      {
        list: [
          "Rozmiar strony — najpierw wybierz „Rozmiar według”. Piksele: wpisz szerokość i wysokość lub wybierz gotowy rozmiar (Mała, Średnia, Duża, Full HD, 4K, A4 @300dpi). Pola siatki: podaj liczbę kolumn i wierszy oraz rozmiar pola, a rozmiar strony zostanie obliczony za Ciebie (siatka zostanie włączona). Orientację zamienisz przyciskiem ⇄.",
          "Siatka — zdecyduj, czy jej potrzebujesz. Jeśli tak, wybierz rozmiar pola: 50, 70 (standard Roll20), 100 (domyślnie w Foundry VTT), 140, 200 lub 256 px (druk / Dungeondraft) albo wpisz dowolny. Wybierz linie lub kropki i kolor. Kreator pokaże, ile pól będzie miała strona.",
          "Szczegóły — nazwa i kolor tła.",
        ],
      },
      "Podgląd obok każdego kroku pokazuje stronę wraz z jej rozmiarem w pikselach i polach.",
      `Boki strony mogą mieć od ${M.minSize} do ${M.maxSize} px. Jeśli rozmiar liczony w polach wyjdzie poza ten zakres, kreator ostrzeże, że siatka nie wypełni strony dokładnie.`,
      "Wszystko to możesz później zmienić w edytorze.",
    ],
  },
  {
    id: "maps",
    title: "Zarządzanie mapami",
    blocks: [
      {
        list: [
          "„Moje mapy” pokazują miniaturę każdej mapy, miejsce zapisu (ta przeglądarka lub Twoje konto) i datę ostatniej zmiany. Na każdej karcie są przyciski Otwórz, Zmień nazwę, Duplikuj i Usuń.",
          "Licznik u góry pokazuje, ile map już wykorzystano. Po osiągnięciu limitu usuń niepotrzebną mapę (albo zaloguj się, jeśli jesteś gościem).",
          "„Importuj plik projektu” otwiera wyeksportowany z MapForge projekt .json jako nową mapę. Po zalogowaniu zapisane w projekcie obrazy trafiają do Moich plików; goście dostają mapę bez tych obrazów.",
          "Po zalogowaniu mapy utworzone jako gość w tej przeglądarce są wypisane w sekcji „Mapy z tej przeglądarki”. „Importuj na konto” przenosi je do chmury.",
        ],
      },
    ],
  },
  {
    id: "layout",
    title: "Edytor w skrócie",
    blocks: [
      {
        list: [
          "Górny pasek — powrót do Moich map, nazwa mapy (kliknij, aby ją zmienić), narzędzia, cofnij/ponów, powiększenie (kliknięcie procentów ustawia 100%), siatka i przyciąganie, Strona i siatka, stan zapisu, Eksport oraz Pomoc i Ustawienia (obie otwierają się w nowej karcie).",
          "Lewy panel — Biblioteka (wbudowane elementy), Moje pliki (Twoje obrazy) oraz Tło (kolor i tekstury).",
          "Płótno — Twoja mapa. Ciemny obszar dookoła jest poza stroną i nie trafia do eksportu.",
          "Prawy panel — właściwości zaznaczonych elementów. Gdy nic nie jest zaznaczone, pokazuje panel Mapa (ustawienia siatki i przycisk Odblokuj, gdy część elementów jest zablokowana). Niżej są warstwy i lista „Wszystkie elementy”. Przy aktywnym Pędzlu lub Gumce prawy panel pokazuje ustawienia pędzla.",
          "Pasek stanu — rozmiar strony, pozycja kursora w pikselach i polach siatki, powiększenie i liczba elementów.",
        ],
      },
    ],
  },
  {
    id: "assets",
    title: "Dodawanie elementów",
    blocks: [
      "Przeciągnij dowolny element z Biblioteki na mapę albo po prostu go kliknij, aby pojawił się na środku widoku. Elementy dostają rozsądny rozmiar liczony w polach siatki (drzewo 2 × 2, żeton 1 × 1) i trafiają automatycznie na odpowiednią warstwę.",
      {
        list: [
          "Filtruj bibliotekę według kategorii (Teren, Natura, Budowle, Loch, Meble, Żetony, Znaczniki) lub szukaj — wyszukiwarka sprawdza polskie i angielskie nazwy oraz tagi we wszystkich pakietach.",
          "Żetony, znaczniki, dywany, narzuty na łóżka i niektóre inne elementy można przebarwiać — kolor zmienisz w panelu Właściwości (Reset przywraca domyślny).",
          "Biblioteka jest podzielona na grupy (pakiety) — kliknij nazwę grupy, aby ją zwinąć; MapForge zapamięta, które grupy zwinięto. Grupy z kłódką i elementy oznaczone ★ wymagają darmowego konta; goście widzą ich nazwy, więc wiedzą, co mogą odblokować.",
          "Tekstury tła wybierasz w zakładce Tło — są pogrupowane według pakietów jak w bibliotece i powtarzają się co pole siatki. Ich wielkość zmienisz suwakiem skali, a opcja Brak zostawia sam kolor.",
        ],
      },
      {
        list: [
          "Pakiet podstawowy (darmowy) — drzewa, skały, mury, drzwi, dom, meble, żetony, znaczniki oraz tekstury trawy, bruku i pergaminu.",
          "Podłogi (darmowe) — posadzka z płyt, kamienne bloki, dno jaskini, klepisko, żwir i stare deski.",
          "Pakiet rozszerzony (konto) — lawa, rzeki, mosty, klify, ruiny, wieże, wyposażenie lochów, więcej żetonów i znaczników oraz tekstury desek, wody, piasku, płyt lochu, śniegu i skały wulkanicznej.",
          "Podłogi+ (konto) — cegła w jodełkę, marmur, płytki heksagonalne, mozaika świątynna, zrujnowana posadzka, płyty kanałów, omszała i kryształowa jaskinia, spękana ziemia, bagienne błoto, leśne runo, parkiet i lód.",
          "Karczma i domy (konto) — karczma, chata i kamienica z dachami, odcinki ścian, słupy, drzwi, okna i schody, pełne wyposażenie karczmy (szynk, beczki, stoły, łóżka, kuchnia i więcej) oraz tekstury desek, płyt, sitowia i parkietu.",
        ],
      },
      { tip: "Ściany, słupy, drzwi i okna z pakietu Karczma i domy mają tę samą grubość, więc po przyciągnięciu do siatki idealnie do siebie pasują." },
    ],
  },
  {
    id: "uploads",
    title: "Moje pliki: własne obrazy, foldery i archiwa",
    blocks: [
      "Wgrywanie własnych obrazów wymaga konta. Otwórz Moje pliki w lewym panelu edytora albo pełną stronę Moje pliki z górnego menu. Obsługiwane obrazy: PNG, JPG, WEBP, GIF i SVG. Pliki SVG pozostają wektorami, obrazy rastrowe zachowują oryginalną rozdzielczość.",
      {
        list: [
          "Kliknij „Wgraj” lub upuść pliki na przeglądarkę plików — trafią do otwartego folderu. Upuszczenie obrazu na mapę wgrywa go do otwartego folderu i umieszcza w miejscu upuszczenia.",
          `Archiwa (ZIP, TAR, TAR.GZ, do ${mb(F.maxArchiveBytes)}) są rozpakowywane przy wgrywaniu: foldery z archiwum są odtwarzane w otwartym folderze (łączone z folderami o tej samej nazwie), a każdy obsługiwany obraz jest dodawany. Pozostałe pliki są pomijane i wypisywane po wgraniu.`,
          "Po wgraniu krótki raport pokazuje, ile plików i folderów dodano, i wypisuje wszystko, co pominięto lub czego nie wgrano, wraz z powodem.",
          "Twórz foldery przyciskiem „Nowy folder”; możesz je zagnieżdżać do " + F.maxFolderDepth + " poziomów. Nazwę pliku lub folderu zmienisz ikoną ołówka (lub F2).",
          "„Szukaj we wszystkich plikach…” przeszukuje nazwy we wszystkich folderach. Pasek wykorzystania pokazuje, ile plików i miejsca już zajmujesz.",
          "Zaznacz kilka elementów polami wyboru, Ctrl/⌘ + klik lub Shift + klik (Ctrl/⌘ + A zaznacza wszystko w folderze). Przenieś je przyciskiem „Przenieś do…” albo przeciągając na folder lub ścieżkę u góry; usuń klawiszem Delete. Usunięcie folderu usuwa całą jego zawartość.",
          "Kliknij obraz w panelu edytora, aby dodać go na środek widoku, lub przeciągnij go (albo kilka zaznaczonych obrazów) na mapę.",
          "Duże obrazy (np. ręcznie rysowana mapa) są dopasowywane do strony i trafiają na warstwę Tło; mniejsze stają się obiektami. Usunięcie pliku usuwa go ze wszystkich map, które go używają.",
        ],
      },
      {
        tip: `Limity: ${U.maxUploads} obrazów, ${mb(U.maxUploadBytes)} na obraz (maks. ${F.maxImageSide} px na bok), łącznie ${mb(U.maxStorageBytes)}, ${F.maxFolders} folderów, ${F.maxArchiveFiles} obrazów w jednym archiwum. Każdy plik jest sprawdzany na serwerze: prawdziwy format jest rozpoznawany po zawartości (nie po nazwie), uszkodzone lub zbyt duże obrazy są odrzucane, pliki SVG są oczyszczane ze skryptów, a pozycje archiwum próbujące wyjść poza swój folder są ignorowane.`,
      },
    ],
  },
  {
    id: "select",
    title: "Zaznaczanie",
    blocks: [
      {
        list: [
          "Kliknij element, aby go zaznaczyć.",
          "Przytrzymaj Ctrl (⌘ na Macu) lub Shift i klikaj, aby dodawać lub usuwać elementy z zaznaczenia — tak wybierzesz wiele elementów naraz.",
          "Przeciągnij po pustym miejscu mapy, aby narysować ramkę zaznaczenia. Z Ctrl dodajesz do bieżącego zaznaczenia.",
          "Ctrl+A zaznacza wszystko na widocznych, odblokowanych warstwach. Kliknięcie nazwy warstwy zaznacza wszystko na niej (także zablokowane elementy).",
          "Esc czyści zaznaczenie.",
        ],
      },
      "Wszystko, co zrobisz dalej — przesuwanie, skalowanie, obracanie, zmiana koloru, warstwy czy usuwanie — dotyczy całego zaznaczenia.",
    ],
  },
  {
    id: "transform",
    title: "Przesuwanie, skalowanie i obracanie",
    blocks: [
      {
        list: [
          "Przesuwanie — przeciągnij zaznaczenie. Przy włączonym przyciąganiu (ikona magnesu, klawisz S) elementy dopasowują się do siatki; przytrzymaj Alt, aby przesuwać swobodnie. Strzałki przesuwają o 1 px, Shift+strzałki o jedno pole.",
          "Zmiana rozmiaru — przeciągnij kwadratowe uchwyty. Narożniki zachowują proporcje; z Shift zmieniasz rozmiar swobodnie. Uchwyty boczne rozciągają w jednym kierunku.",
          "Obracanie — przeciągnij okrągły uchwyt nad zaznaczeniem. Obrót skacze co 15° (Alt wyłącza skok). Klawisze Q / E obracają o 15°, Shift+Q / Shift+E o 90°.",
          "Skalowanie — użyj przycisków 50% / 90% / 110% / 200%, wpisz dowolny procent lub naciśnij [ i ], aby zmniejszyć lub powiększyć o 10%. Działa dla dowolnej liczby zaznaczonych elementów.",
          "Odbicie, blokada, przyciągnięcie do siatki i kolejność (na wierzch / na spód) są w panelu Właściwości.",
          "Kliknij element prawym przyciskiem myszy, aby otworzyć szybkie menu: wytnij, kopiuj, wklej, duplikuj, zmień nazwę (lub edytuj tekst), przenieś na inną warstwę, zmień kolejność, Przekształć (obrót o 90°, powiększenie lub pomniejszenie o 10%, odbicie), przyciągnij do siatki, zablokuj/odblokuj i usuń. Zablokowany element też możesz tak odblokować, a prawy klik na pustym miejscu daje „Wklej tutaj”, „Zaznacz wszystko”, „Dopasuj mapę do ekranu” oraz przełączniki siatki i przyciągania.",
          "Przy dwóch lub więcej elementach możesz je wyrównać (do lewej, środka, prawej, góry, środka w pionie, dołu), a przy trzech i więcej — rozłożyć równomiernie.",
        ],
      },
    ],
  },
  {
    id: "tools",
    title: "Narzędzia rysowania",
    blocks: [
      {
        list: [
          "Tekst (T) — kliknij puste miejsce, aby dodać napis, i pisz. Kliknij dwukrotnie istniejący napis, aby go edytować (przy aktywnym narzędziu Tekst wystarczy jedno kliknięcie). Czcionka (szeryfowa, bezszeryfowa, o stałej szerokości, fantasy), rozmiar, pogrubienie, kursywa, kolor i poświata poprawiająca czytelność są we Właściwościach.",
          "Prostokąt (R) i Elipsa (O) — przeciągnij, aby narysować pomieszczenia, jeziora czy obszary działania czarów. Shift rysuje kwadrat/koło. Wypełnienie, krycie wypełnienia, obrys, grubość obrysu i (dla prostokątów) zaokrąglenie narożników są we Właściwościach.",
          "Rysowanie / ściany (P) — rysuj cienkie linie, np. ściany jaskiń lub granice. Shift rysuje linię prostą. Zaznacz „Kształt zamknięty” we Właściwościach, aby zamknąć ścieżkę i ją wypełnić.",
          "Pędzel (B) i Gumka (X) — maluj ręcznie rzeki, drogi, ścieżki i teren kolorem albo teksturą. Szczegóły w części „Malowanie pędzlem” poniżej.",
          "Pomiar (M) — przeciągnij, aby zmierzyć odległość. MapForge stosuje zasadę D&D 5e (przekątna liczy się jako jedno pole) i 5 stóp na pole.",
          "Przesuwanie widoku (H) — przeciągnij, aby przesunąć widok. Możesz też przytrzymać Spację lub środkowy przycisk myszy przy dowolnym narzędziu.",
        ],
      },
    ],
  },
  {
    id: "painting",
    title: "Malowanie pędzlem",
    blocks: [
      "Pędzel (B) pozwala malować ręcznie — rzeki, strumienie, drogi, ścieżki, potoki lawy, płaty piasku, trawy czy śniegu, szlaki, płoty, tory i urwiska — albo rozsypywać drzewa i skały wzdłuż pociągnięcia. Wybierz Pędzel na pasku narzędzi; jego ustawienia pojawią się w prawym panelu. Przełącznik na górze wybiera Farbę albo Rozsypywanie.",
      {
        list: [
          "Gotowe pędzle — jedno kliknięcie ustawia pędzel. Obszary i drogi: Rzeka, Strumień, Droga, Ścieżka, Lawa, Piasek, Trawa, Śnieg, Mur. Linie: Szlak, Ścieżka kropkowana, Stara droga, Tory, Płot, Urwisko. Postrzępione brzegi: Wybrzeże, Staw, Ściana jaskini, Gruz. Pędzle z teksturą z rozszerzonego pakietu malują gościom samym kolorem (oznaczone kłódką).",
          "Styl linii — Pełna (pas farby), Kreskowana lub Kropkowana (szlaki, ścieżki), Podwójna (dwie równoległe linie z pustym środkiem, jak drogi na starych mapach), Tory (szyny na podkładach), Płot (linia ze słupkami) albo Urwisko (linia z kreskowaniem po jednej stronie — zaznacz „Kreskowanie po drugiej stronie”, aby je przenieść). Odstęp ustala przerwy między kreskami, kropkami, podkładami, słupkami lub kreskowaniem; Tory i Płot mają drugi kolor podkładów / słupków. Tory, Płot i Urwisko są rysowane tylko kolorem.",
          "Postrzępiona krawędź (linia pełna) — nieregularny, naturalny brzeg zamiast gładkiego: małe wartości dla wybrzeży i stawów, duże dla ścian jaskiń i gruzu. Działa z teksturami, obrzeżem i miękkimi krawędziami.",
          "Farba — kolor, tekstura z biblioteki albo obraz z Moich plików (dla zalogowanych; powtarza się jako kwadratowe kafelki). Kolor bazowy widać pod teksturą i jest używany, gdy tekstury nie da się pokazać. Tekstury są zakotwiczone w mapie, więc stykające się pociągnięcia mają ciągły wzór.",
          "Rozmiar podaje się w polach siatki, więc pędzel pasuje do każdej mapy. [ i ] zmniejszają i zwiększają go w trakcie malowania; obrys pod kursorem pokazuje rozmiar.",
          "Miękkie krawędzie rozmywają brzeg pociągnięcia, Wygładzanie wyrównuje drżenie ręki, a Obrzeże dodaje obwódkę wzdłuż pociągnięcia — brzegi rzeki, krawężniki, skorupę lawy.",
          "Maluj na warstwie decyduje, gdzie trafiają pociągnięcia (domyślnie Teren, więc obiekty i żetony są nad nimi).",
          "Łącz pasujące pociągnięcia — pociągnięcie zaczęte na farbie tego samego pędzla staje się jego częścią, więc rozwidlenia, skrzyżowania i połączenia nie mają szwów ani podwójnych brzegów.",
          "Shift + przeciągnięcie rysuje linię prostą; Shift + klik rysuje linię prostą od końca poprzedniego pociągnięcia (przy włączonym przyciąganiu koniec trafia w siatkę).",
        ],
      },
      "Gumka (X) zmazuje farbę z pociągnięć pędzla na widocznych i odblokowanych warstwach — przeciągnij przez rzekę, aby zrobić bród, albo popraw krawędź. Całkiem zmazane pociągnięcie znika. Zmazania są zapisane w pociągnięciu, więc cofniesz je Ctrl+Z albo później przyciskiem „Przywróć zmazane fragmenty”.",
      "Gumka działa też na wgranych obrazach i grafikach z biblioteki: najpierw zaznacz grafikę (V), potem naciśnij X (albo użyj „Zmazuj fragmenty” we właściwościach lub w menu pod prawym przyciskiem). Gdy grafika jest zaznaczona, gumka zmienia tylko zaznaczenie — pociągnięcia pędzla i inne elementy zostają bez zmian. Przełącz tryb na Przywracaj (albo przytrzymaj Alt na jedno pociągnięcie), aby domalować zmazane fragmenty, a Miękkość daje rozmytą krawędź, która wtapia obraz w mapę. Zmazywanie nigdy nie zmienia oryginalnego pliku: jest zapisane w elemencie, podąża za nim przy przesuwaniu, obracaniu, odbijaniu i zmianie rozmiaru, a „Pokaż zmazane fragmenty” przywraca całą grafikę.",
      "Każde namalowane pociągnięcie to zwykły element: zaznacz je, aby przesunąć, obrócić, przeskalować, zmienić warstwę albo wygląd (rozmiar, styl linii, postrzępienie, farbę, skalę tekstury, miękkość, obrzeże). „Maluj tym pędzlem” kopiuje wygląd pociągnięcia z powrotem do pędzla.",
      "Rozsypywanie rozrzuca grafiki z biblioteki wzdłuż pociągnięcia — skraj lasu, skały pod urwiskiem, kępy trawy, skrzynie na podwórzu. Wybierz gotowy pędzel (Las, Sosny, Krzaki, Kępy trawy, Skały, Martwe drzewa, Grzyby, Pustynia, Graty) albo sam wybierz do 12 grafik; dostępne są tylko pakiety, których możesz używać. Rozmiar skaluje grafiki, Zróżnicowanie rozmiaru miesza duże i małe, Odstęp ustala przerwy (100% = prawie się stykają), Rozrzut rozsypuje je w poprzek pociągnięcia, a Obrót jest Losowy, Wzdłuż (pociągnięcia) albo Brak. „Własna warstwa każdej grafiki” kładzie drzewa na Obiektach, a trawę na Terenie — albo wybierz jedną warstwę dla wszystkich.",
      "Każda rozsypana grafika to zwykły element, który można przesunąć, przebarwić, częściowo zmazać albo usunąć. Jedno Ctrl+Z cofa całe pociągnięcie. [ i ] zmieniają ich rozmiar.",
      { tip: "Maluj rzeki i drogi na warstwie Teren, a mosty i drzewa z biblioteki stawiaj nad nimi na warstwie Obiekty — albo jednym pociągnięciem rozsyp las wzdłuż brzegu rzeki." },
    ],
  },
  {
    id: "layers",
    title: "Warstwy",
    blocks: [
      "Każdy element należy do jednej z pięciu warstw, rysowanych od dołu: Tło, Teren, Obiekty, Żetony i Napisy. Ikoną oka ukryjesz warstwę, a kłódką zabezpieczysz ją przed przypadkową zmianą — zablokowanych warstw nie da się zaznaczyć na płótnie, więc można swobodnie rysować nad nimi ramkę zaznaczenia.",
      "Warstwę elementu zmienisz w panelu Właściwości. Pojedyncze elementy też można blokować (klawisz L); odblokujesz je przez „Zaznacz wszystko na warstwie” lub przycisk Odblokuj w panelu Mapa, widocznym, gdy nic nie jest zaznaczone.",
      "„Wszystkie elementy” (pod warstwami) to lista wszystkich elementów mapy. Kliknij wiersz, aby zaznaczyć element i wyśrodkować na nim widok (Ctrl/Shift + klik dodaje go do zaznaczenia), usuń go ikoną kosza albo kliknij prawym przyciskiem, aby wybrać Zmień nazwę, Przywróć domyślną nazwę, Zablokuj/Odblokuj i Usuń — działa to także dla elementów na ukrytych warstwach. Ikony w wierszu pokazują, czy element lub jego warstwa jest zablokowana lub ukryta.",
      "Elementom możesz nadawać własne nazwy (np. „Tajne drzwi”, „Leże bossa”): kliknij element dwukrotnie na mapie lub na liście „Wszystkie elementy”, kliknij go prawym przyciskiem i wybierz „Zmień nazwę”, naciśnij F2 albo wpisz nazwę w polu Nazwa w panelu Właściwości. Wyczyść nazwę, aby wrócić do domyślnej. Nazwy widać tylko w edytorze, nigdy na eksportowanym obrazie.",
    ],
  },
  {
    id: "view",
    title: "Powiększanie i nawigacja",
    blocks: [
      {
        list: [
          "Kółko myszy przybliża wokół kursora (na touchpadzie gest szczypania). Shift+kółko przewija w poziomie.",
          "+ / − przybliża i oddala, 0 (lub Ctrl+0) dopasowuje mapę do ekranu, 1 pokazuje ją w 100%. To samo robią przyciski powiększenia na górnym pasku; kliknięcie procentów ustawia 100%.",
          "Przytrzymaj Spację i przeciągnij, przeciągnij środkowym przyciskiem myszy lub użyj narzędzia Przesuwanie.",
          "G pokazuje lub ukrywa siatkę, S włącza i wyłącza przyciąganie.",
        ],
      },
    ],
  },
  {
    id: "resolution",
    title: "Rozmiar strony i rozdzielczość",
    blocks: [
      "Otwórz „Strona i siatka” (ikona zębatki), aby w każdej chwili zmienić rozmiar strony. Według pikseli — użyj gotowych rozmiarów, szybkich przycisków ½× / 2× lub wpisz dokładne wartości (z zachowaniem proporcji lub bez) — albo według pól siatki — ustaw liczbę kolumn, wierszy i rozmiar pola (⇄ zamienia kolumny z wierszami). Okno pokazuje, ile pól będzie miała nowa strona. Dostępne są dwa tryby:",
      {
        list: [
          "Skaluj wszystko — cała mapa razem z siatką jest skalowana do nowego rozmiaru. Idealne do przygotowania wersji w wyższej rozdzielczości.",
          "Zmień płótno — zawartość zachowuje rozmiar, a strona rośnie lub maleje wokół niej. Zakotwiczenie decyduje, z której strony przybywa miejsca.",
        ],
      },
      "Ponieważ wszystkie elementy są wektorami, powiększanie nie obniża jakości. Rozmiar, styl, kolor, krycie i grubość linii siatki zmienisz tutaj lub w panelu właściwości mapy.",
    ],
  },
  {
    id: "saving",
    title: "Zapisywanie",
    blocks: [
      "Nie ma przycisku zapisu — każda zmiana zapisuje się automatycznie w niecałą sekundę po zakończeniu edycji (i co najmniej co kilka sekund podczas ciągłej pracy). Wskaźnik na górnym pasku pokazuje, gdzie mapa jest zapisywana (ikona chmury: Twoje konto, ikona laptopa: ta przeglądarka), oraz stan: zapisano, zapisywanie, niezapisane zmiany, brak połączenia lub błąd. Gdy zapis się nie uda albo zniknie połączenie, MapForge ponawia próbę automatycznie. Ctrl+S lub kliknięcie wskaźnika zapisuje od razu.",
      "Jeśli ta sama mapa jest edytowana w dwóch kartach lub na dwóch urządzeniach, wskaźnik pokaże „Zmieniono gdzie indziej”, a Ty wybierzesz: „Wczytaj ich wersję” albo „Zachowaj moją (nadpisz)” — nic nie zostanie nadpisane po cichu.",
      "Cofnij (Ctrl+Z) i ponów (Ctrl+Shift+Z lub Ctrl+Y) pamiętają do 150 kroków w trakcie sesji.",
    ],
  },
  {
    id: "export",
    title: "Eksport i import",
    blocks: [
      {
        list: [
          "PNG / JPEG / WebP — wybierz rozdzielczość 0,5×, 1×, 2×, 3× lub 4×; okno pokazuje wynikowy rozmiar. Mapa 1400 × 1050 wyeksportowana w 2× ma 2800 × 2100 px i pozostaje ostra. Siatkę możesz dołączyć lub ukryć (większość VTT rysuje własną). Nazwa pliku zawiera skalę, np. „Krypta@2x.png”.",
          "WebP — znacznie mniejsze pliki niż PNG przy podobnej jakości, wygodne do udostępniania i wgrywania do VTT. Niektóre przeglądarki (np. Safari) nie zapisują WebP — zobaczysz wtedy komunikat; wybierz PNG lub JPEG.",
          "Plik projektu (.json) — pełna kopia zapasowa razem z wgranymi obrazami. Zaimportujesz ją przyciskiem „Importuj plik projektu” na stronie „Moje mapy” na dowolnym komputerze lub koncie.",
        ],
      },
      { tip: "Używasz VTT? Ustaw w nim rozmiar siatki na rozmiar pola × skala eksportu — np. pola 70 px w 1× dla Roll20 albo 100 px w 1× dla Foundry." },
    ],
  },
  {
    id: "settings",
    title: "Ustawienia i język",
    blocks: [
      "Ustawienia otworzysz ikoną suwaków w górnym menu lub na górnym pasku edytora. Są dostępne dla gości i zalogowanych.",
      {
        list: [
          "Język — polski lub angielski, dla całego interfejsu. Wybór jest zapisywany w tej przeglądarce i od razu stosowany we wszystkich otwartych kartach MapForge.",
          "Konto — pokazuje, na kogo jesteś zalogowany, albo przypomina, że mapy gościa istnieją tylko w tej przeglądarce.",
        ],
      },
    ],
  },
  {
    id: "shortcuts",
    title: "Skróty klawiszowe",
    blocks: [
      {
        keys: [
          ["V / H / T / R / O / P / M", "Zaznaczanie / Przesuwanie / Tekst / Prostokąt / Elipsa / Rysowanie / Pomiar"],
          ["B / X", "Pędzel / Gumka"],
          ["Ctrl + klik, Shift + klik", "Dodaj / usuń element z zaznaczenia"],
          ["Ctrl + A", "Zaznacz wszystko"],
          ["Esc", "Wyczyść zaznaczenie, wróć do zaznaczania"],
          ["Delete / Backspace", "Usuń zaznaczenie"],
          ["Ctrl + C / X / V", "Kopiuj / wytnij / wklej"],
          ["Ctrl + D", "Duplikuj"],
          ["Ctrl + Z / Ctrl + Shift + Z, Ctrl + Y", "Cofnij / ponów"],
          ["Strzałki / Shift + strzałki", "Przesuń o 1 px / jedno pole"],
          ["[ / ]", "Skaluj zaznaczenie −10% / +10% (przy pędzlu lub gumce: mniejszy / większy pędzel)"],
          ["Shift + przeciągnij, Shift + klik", "Pędzel: linia prosta / linia od końca poprzedniego pociągnięcia"],
          ["Alt + przeciągnij", "Gumka na zaznaczonym obrazie / grafice: zamień zmazywanie ↔ przywracanie na jedno pociągnięcie"],
          ["Q / E (Shift)", "Obróć −15° / +15° (90°)"],
          ["PgUp / PgDn / Home / End", "Do przodu / do tyłu / na spód / na wierzch"],
          ["L", "Zablokuj / odblokuj zaznaczenie"],
          ["F2, dwuklik", "Zmień nazwę zaznaczonego elementu (dwuklik na napisie edytuje tekst)"],
          ["G / S", "Siatka / przyciąganie"],
          ["Alt (podczas przeciągania)", "Chwilowo wyłącz przyciąganie"],
          ["Spacja + przeciągnij, środkowy przycisk", "Przesuwanie widoku"],
          ["Kółko, + / −, 0 lub Ctrl + 0, 1", "Powiększenie, dopasuj do ekranu, 100%"],
          ["Ctrl + S", "Zapisz teraz"],
          ["Enter / Esc", "Podczas zmiany nazwy: zapisz / anuluj"],
        ],
      },
    ],
  },
  {
    id: "faq",
    title: "Rozwiązywanie problemów",
    blocks: [
      {
        list: [
          "„Osiągnięto limit” — usuń niepotrzebną mapę lub zaloguj się, aby zwiększyć limit.",
          "Element wyświetla się jako czerwony znak zapytania — pochodzi z grupy wymagającej konta (zaloguj się, aby go zobaczyć) albo odwołuje się do usuniętego pliku.",
          "Nie mogę kliknąć elementu — prawdopodobnie jego warstwa lub on sam jest zablokowany. Sprawdź kłódki w panelu Warstwy.",
          "Eksport jest za duży — przeglądarki nie tworzą obrazów szerszych lub wyższych niż 16384 px. Wybierz mniejszą skalę.",
          "„Twoja przeglądarka nie zapisuje tego formatu” — przeglądarka nie potrafi zapisać WebP (np. Safari). Wybierz PNG lub JPEG albo użyj innej przeglądarki.",
          "Pędzel nie maluje — warstwa wybrana w „Maluj na warstwie” jest zablokowana lub ukryta. Odblokuj ją, pokaż albo wybierz inną.",
          "Wskaźnik zapisu pokazuje „Brak połączenia” lub „Błąd zapisu” — zmiany są zachowane i MapForge zapisze je, gdy połączenie wróci. Nie zamykaj karty, dopóki nie zobaczysz „Wszystkie zmiany zapisane”.",
          "Biblioteka nie mogła wczytać elementów — kliknij „Spróbuj ponownie”; jeśli to nie pomoże, odśwież stronę.",
          "Plik nie został wgrany — raport po wgraniu podaje powód (np. nieobsługiwany format, za duży, uszkodzony lub niebezpieczny SVG). Sprawdź limity w części o Moich plikach powyżej.",
        ],
      },
    ],
  },
];
