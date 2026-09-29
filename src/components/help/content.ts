import { LIMITS } from "@/lib/limits";

export type Block = string | { list: string[] } | { keys: [string, string][] } | { tip: string };
export interface HelpSection {
  id: string;
  title: string;
  blocks: Block[];
}

const A = LIMITS.anonymous;
const U = LIMITS.user;
const mb = (n: number) => `${n / 1024 / 1024} MB`;

export const HELP_EN: HelpSection[] = [
  {
    id: "start",
    title: "Getting started",
    blocks: [
      "MapForge is a browser-based editor for battle maps used in Dungeons & Dragons and other tabletop RPGs. Everything you place on a map is a vector (SVG), so maps stay sharp at any zoom level and export resolution.",
      {
        list: [
          `Guests (no account): up to ${A.maxMaps} maps, saved in this browser (IndexedDB), the free asset pack, up to ${A.maxUploads} uploaded files of max ${mb(A.maxUploadBytes)} each.`,
          `Logged-in users: up to ${U.maxMaps} maps saved in the cloud (available on every device), the extended asset pack with extra assets and textures, up to ${U.maxUploads} uploaded files of max ${mb(U.maxUploadBytes)} each.`,
          "After signing in you can import the maps you created as a guest into your account from the “My maps” page.",
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
          "Page size in pixels — type the width and height or pick a preset (e.g. 1400 × 1050, Full HD, 4K, A4 at 300 dpi). You can swap the orientation with ⇄.",
          "Grid — decide whether you need a grid. If yes, pick the cell size. 70 px is the Roll20 standard, 100 px is the Foundry VTT default, 256 px is common for print-quality maps. Choose lines or dots and a colour. The wizard shows how many cells your page will have.",
          "Details — a name and the background colour.",
        ],
      },
      "All of this can be changed later in the editor, so don't worry about getting it perfect.",
    ],
  },
  {
    id: "layout",
    title: "The editor at a glance",
    blocks: [
      {
        list: [
          "Top bar — map name, tools, undo/redo, zoom, grid & snap toggles, page settings, save status, export, help and app settings (language).",
          "Left panel — Library (built-in assets), My files (your uploads) and Background (colour and textures).",
          "Canvas — your map. The dark area around it is outside the page and is not exported.",
          "Right panel — properties of the selected items (or map info when nothing is selected) and the layer list.",
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
          "Filter the library by category or search by name.",
          "Tokens, markers and some other assets are tintable — change their colour in the Properties panel.",
          "Assets marked ★ belong to the extended pack, available after logging in. Guests see what they would unlock at the bottom of the library.",
          "Background textures (grass, cobblestone, wood, water…) are chosen in the Background tab and tile at the grid size; adjust them with the texture scale slider.",
        ],
      },
    ],
  },
  {
    id: "uploads",
    title: "Using your own files",
    blocks: [
      "Open My files and click “Upload files”, or drop image files straight onto the map. Supported formats: PNG, JPG, WEBP, GIF and SVG. SVG files stay vectors; raster images keep their original resolution.",
      {
        list: [
          "Dropping a file on the map uploads it and places it where you dropped it.",
          "Large images (for example a hand-drawn map) are fitted to the page and put on the Background layer; smaller ones become objects.",
          "Guest files are stored in the browser, account files in the database. Deleting a file removes it from every map that uses it.",
          "For security, uploaded SVGs are cleaned of scripts and are always displayed as images.",
        ],
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
          "Right-click an item for a quick menu: cut, copy, paste, duplicate, move to another layer, change the order, rotate, flip, lock/unlock and delete. Right-clicking a locked item still lets you unlock it; right-clicking empty space offers “Paste here”, “Select all” and grid options.",
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
          "Text (T) — click to place a label, then type. Double-click a label to edit it. Font, size, colour and a readability halo are in Properties.",
          "Rectangle (R) and Ellipse (O) — drag to draw areas such as rooms, lakes or zones of effect. Shift draws a square/circle.",
          "Freehand / walls (P) — draw rivers, roads, cave walls or paths. Hold Shift for a straight line. Paths can be closed and filled.",
          "Measure (M) — drag to measure a distance. MapForge uses the D&D 5e rule (diagonals count as one cell) and 5 ft per cell.",
          "Pan (H) — drag to move the view. You can also hold Space or the middle mouse button with any tool.",
        ],
      },
    ],
  },
  {
    id: "layers",
    title: "Layers",
    blocks: [
      "Every item belongs to one of five layers, drawn from bottom to top: Background, Terrain, Objects, Tokens and Labels. Use the eye icon to hide a layer and the lock icon to protect it from accidental changes — locked layers can't be selected on the canvas, so you can draw selection boxes over them freely.",
      "Change an item's layer in the Properties panel. Individual items can be locked too (key L); unlock them via “Select all on layer” or the Unlock button shown in map properties.",
    ],
  },
  {
    id: "view",
    title: "Zooming and navigation",
    blocks: [
      {
        list: [
          "Mouse wheel zooms around the cursor (pinch on a trackpad). Shift+wheel scrolls sideways.",
          "+ / − zoom in and out, 0 fits the map to the screen, 1 shows it at 100%.",
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
      "Open “Page & grid” (gear icon) to change the page size at any time. Use the presets, ½× / 2× quick buttons, or type exact values (with or without keeping the aspect ratio). Two modes are available:",
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
      "There is no save button — every change is stored automatically about a second after you stop editing (and at least every few seconds while you keep working). The indicator in the top bar shows the state: saved, saving, unsaved, or an error (MapForge retries automatically). Ctrl+S forces an immediate save.",
      "If the same map is edited in two tabs or on two devices, MapForge detects it and lets you choose which version to keep, so nothing is overwritten silently.",
      "Undo (Ctrl+Z) and redo (Ctrl+Shift+Z or Ctrl+Y) remember up to 150 steps during the session.",
    ],
  },
  {
    id: "export",
    title: "Export and import",
    blocks: [
      {
        list: [
          "PNG / JPEG / WebP — choose a resolution from 0.5× to 4×. A 1400 × 1050 map exported at 2× is 2800 × 2100 px and stays crisp. You can include or hide the grid (most VTTs draw their own grid).",
          "WebP — much smaller files than PNG at similar quality, handy for sharing and VTT uploads.",
          "Project file (.json) — a complete backup including your uploaded images. Import it on the “My maps” page on any computer or account.",
        ],
      },
      { tip: "Using a VTT? Set its grid size to your cell size × export scale — e.g. 70 px cells exported at 1× for Roll20, or 100 px at 1× for Foundry." },
    ],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    blocks: [
      {
        keys: [
          ["V / H / T / R / O / P / M", "Select / Pan / Text / Rectangle / Ellipse / Freehand / Measure"],
          ["Ctrl + click, Shift + click", "Add / remove item from selection"],
          ["Ctrl + A", "Select all"],
          ["Esc", "Clear selection, back to Select tool"],
          ["Delete / Backspace", "Delete selection"],
          ["Ctrl + C / X / V", "Copy / cut / paste"],
          ["Ctrl + D", "Duplicate"],
          ["Ctrl + Z / Ctrl + Shift + Z", "Undo / redo"],
          ["Arrows / Shift + arrows", "Nudge 1 px / one cell"],
          ["[ / ]", "Scale selection −10% / +10%"],
          ["Q / E (Shift)", "Rotate −15° / +15° (90°)"],
          ["PgUp / PgDn / Home / End", "Forward / backward / to back / to front"],
          ["L", "Lock / unlock selection"],
          ["G / S", "Toggle grid / snapping"],
          ["Alt (while dragging)", "Temporarily disable snapping"],
          ["Space + drag, middle mouse", "Pan"],
          ["Wheel, + / −, 0, 1", "Zoom, fit to screen, 100%"],
          ["Ctrl + S", "Save now"],
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
          "An asset shows as a red question mark — it comes from the extended pack (log in to see it) or refers to a file that was deleted.",
          "I can't click an item — its layer or the item itself is probably locked. Check the lock icons in the Layers panel.",
          "Export is too large — browsers can't create images wider or taller than 16384 px. Use a smaller scale.",
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
          `Goście (bez konta): do ${A.maxMaps} map zapisanych w tej przeglądarce (IndexedDB), darmowy pakiet grafik, do ${A.maxUploads} własnych plików po maks. ${mb(A.maxUploadBytes)}.`,
          `Zalogowani: do ${U.maxMaps} map zapisanych w chmurze (dostępnych na każdym urządzeniu), rozszerzony pakiet z dodatkowymi elementami i teksturami, do ${U.maxUploads} plików po maks. ${mb(U.maxUploadBytes)}.`,
          "Po zalogowaniu możesz zaimportować mapy utworzone jako gość na swoje konto — na stronie „Moje mapy”.",
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
          "Rozmiar strony w pikselach — wpisz szerokość i wysokość lub wybierz gotowy rozmiar (np. 1400 × 1050, Full HD, 4K, A4 w 300 dpi). Orientację zamienisz przyciskiem ⇄.",
          "Siatka — zdecyduj, czy jej potrzebujesz. Jeśli tak, wybierz rozmiar pola. 70 px to standard Roll20, 100 px to domyślna wartość Foundry VTT, 256 px sprawdza się przy mapach do druku. Wybierz linie lub kropki i kolor. Kreator pokaże, ile pól będzie miała strona.",
          "Szczegóły — nazwa i kolor tła.",
        ],
      },
      "Wszystko to możesz później zmienić w edytorze.",
    ],
  },
  {
    id: "layout",
    title: "Edytor w skrócie",
    blocks: [
      {
        list: [
          "Górny pasek — nazwa mapy, narzędzia, cofnij/ponów, powiększenie, siatka i przyciąganie, ustawienia strony, stan zapisu, eksport, pomoc i ustawienia aplikacji (język).",
          "Lewy panel — Biblioteka (wbudowane elementy), Moje pliki (Twoje obrazy) oraz Tło (kolor i tekstury).",
          "Płótno — Twoja mapa. Ciemny obszar dookoła jest poza stroną i nie trafia do eksportu.",
          "Prawy panel — właściwości zaznaczonych elementów (lub informacje o mapie, gdy nic nie jest zaznaczone) oraz lista warstw.",
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
          "Filtruj bibliotekę według kategorii lub szukaj po nazwie.",
          "Żetony, znaczniki i niektóre inne elementy można przebarwiać — kolor zmienisz w panelu Właściwości.",
          "Elementy oznaczone ★ należą do rozszerzonego pakietu, dostępnego po zalogowaniu. Goście widzą na dole biblioteki, co mogą odblokować.",
          "Tekstury tła (trawa, bruk, deski, woda…) wybierasz w zakładce Tło — powtarzają się co pole siatki, a ich wielkość zmienisz suwakiem skali.",
        ],
      },
    ],
  },
  {
    id: "uploads",
    title: "Własne pliki",
    blocks: [
      "Otwórz Moje pliki i kliknij „Wgraj pliki” albo upuść obrazy prosto na mapę. Obsługiwane formaty: PNG, JPG, WEBP, GIF i SVG. Pliki SVG pozostają wektorami, obrazy rastrowe zachowują oryginalną rozdzielczość.",
      {
        list: [
          "Upuszczenie pliku na mapę wgrywa go i umieszcza w miejscu upuszczenia.",
          "Duże obrazy (np. ręcznie rysowana mapa) są dopasowywane do strony i trafiają na warstwę Tło; mniejsze stają się obiektami.",
          "Pliki gościa są przechowywane w przeglądarce, pliki konta — w bazie danych. Usunięcie pliku usuwa go ze wszystkich map, które go używają.",
          "Ze względów bezpieczeństwa wgrane pliki SVG są oczyszczane ze skryptów i zawsze wyświetlane jako obrazy.",
        ],
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
          "Kliknij element prawym przyciskiem myszy, aby otworzyć szybkie menu: wytnij, kopiuj, wklej, duplikuj, przenieś na inną warstwę, zmień kolejność, obróć, odbij, zablokuj/odblokuj i usuń. Zablokowany element też możesz tak odblokować, a prawy klik na pustym miejscu daje „Wklej tutaj”, „Zaznacz wszystko” i opcje siatki.",
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
          "Tekst (T) — kliknij, aby dodać napis, i pisz. Kliknij dwukrotnie napis, aby go edytować. Czcionka, rozmiar, kolor i poświata poprawiająca czytelność są we Właściwościach.",
          "Prostokąt (R) i Elipsa (O) — przeciągnij, aby narysować pomieszczenia, jeziora czy obszary działania czarów. Shift rysuje kwadrat/koło.",
          "Rysowanie / ściany (P) — rysuj rzeki, drogi, ściany jaskiń lub ścieżki. Shift rysuje linię prostą. Ścieżki można zamknąć i wypełnić.",
          "Pomiar (M) — przeciągnij, aby zmierzyć odległość. MapForge stosuje zasadę D&D 5e (przekątna liczy się jako jedno pole) i 5 stóp na pole.",
          "Przesuwanie widoku (H) — przeciągnij, aby przesunąć widok. Możesz też przytrzymać Spację lub środkowy przycisk myszy przy dowolnym narzędziu.",
        ],
      },
    ],
  },
  {
    id: "layers",
    title: "Warstwy",
    blocks: [
      "Każdy element należy do jednej z pięciu warstw, rysowanych od dołu: Tło, Teren, Obiekty, Żetony i Napisy. Ikoną oka ukryjesz warstwę, a kłódką zabezpieczysz ją przed przypadkową zmianą — zablokowanych warstw nie da się zaznaczyć na płótnie, więc można swobodnie rysować nad nimi ramkę zaznaczenia.",
      "Warstwę elementu zmienisz w panelu Właściwości. Pojedyncze elementy też można blokować (klawisz L); odblokujesz je przez „Zaznacz wszystko na warstwie” lub przycisk Odblokuj we właściwościach mapy.",
    ],
  },
  {
    id: "view",
    title: "Powiększanie i nawigacja",
    blocks: [
      {
        list: [
          "Kółko myszy przybliża wokół kursora (na touchpadzie gest szczypania). Shift+kółko przewija w poziomie.",
          "+ / − przybliża i oddala, 0 dopasowuje mapę do ekranu, 1 pokazuje ją w 100%.",
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
      "Otwórz „Strona i siatka” (ikona zębatki), aby w każdej chwili zmienić rozmiar strony. Użyj gotowych rozmiarów, szybkich przycisków ½× / 2× lub wpisz dokładne wartości (z zachowaniem proporcji lub bez). Dostępne są dwa tryby:",
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
      "Nie ma przycisku zapisu — każda zmiana zapisuje się automatycznie około sekundy po zakończeniu edycji (i co najmniej co kilka sekund podczas ciągłej pracy). Wskaźnik na górnym pasku pokazuje stan: zapisano, zapisywanie, niezapisane zmiany lub błąd (MapForge ponawia próbę automatycznie). Ctrl+S wymusza natychmiastowy zapis.",
      "Jeśli ta sama mapa jest edytowana w dwóch kartach lub na dwóch urządzeniach, MapForge to wykryje i pozwoli wybrać wersję do zachowania — nic nie zostanie nadpisane po cichu.",
      "Cofnij (Ctrl+Z) i ponów (Ctrl+Shift+Z lub Ctrl+Y) pamiętają do 150 kroków w trakcie sesji.",
    ],
  },
  {
    id: "export",
    title: "Eksport i import",
    blocks: [
      {
        list: [
          "PNG / JPEG / WebP — wybierz rozdzielczość od 0,5× do 4×. Mapa 1400 × 1050 wyeksportowana w 2× ma 2800 × 2100 px i pozostaje ostra. Siatkę możesz dołączyć lub ukryć (większość VTT rysuje własną).",
          "WebP — znacznie mniejsze pliki niż PNG przy podobnej jakości, wygodne do udostępniania i wgrywania do VTT.",
          "Plik projektu (.json) — pełna kopia zapasowa razem z wgranymi obrazami. Zaimportujesz ją na stronie „Moje mapy” na dowolnym komputerze lub koncie.",
        ],
      },
      { tip: "Używasz VTT? Ustaw w nim rozmiar siatki na rozmiar pola × skala eksportu — np. pola 70 px w 1× dla Roll20 albo 100 px w 1× dla Foundry." },
    ],
  },
  {
    id: "shortcuts",
    title: "Skróty klawiszowe",
    blocks: [
      {
        keys: [
          ["V / H / T / R / O / P / M", "Zaznaczanie / Przesuwanie / Tekst / Prostokąt / Elipsa / Rysowanie / Pomiar"],
          ["Ctrl + klik, Shift + klik", "Dodaj / usuń element z zaznaczenia"],
          ["Ctrl + A", "Zaznacz wszystko"],
          ["Esc", "Wyczyść zaznaczenie, wróć do zaznaczania"],
          ["Delete / Backspace", "Usuń zaznaczenie"],
          ["Ctrl + C / X / V", "Kopiuj / wytnij / wklej"],
          ["Ctrl + D", "Duplikuj"],
          ["Ctrl + Z / Ctrl + Shift + Z", "Cofnij / ponów"],
          ["Strzałki / Shift + strzałki", "Przesuń o 1 px / jedno pole"],
          ["[ / ]", "Skaluj zaznaczenie −10% / +10%"],
          ["Q / E (Shift)", "Obróć −15° / +15° (90°)"],
          ["PgUp / PgDn / Home / End", "Do przodu / do tyłu / na spód / na wierzch"],
          ["L", "Zablokuj / odblokuj zaznaczenie"],
          ["G / S", "Siatka / przyciąganie"],
          ["Alt (podczas przeciągania)", "Chwilowo wyłącz przyciąganie"],
          ["Spacja + przeciągnij, środkowy przycisk", "Przesuwanie widoku"],
          ["Kółko, + / −, 0, 1", "Powiększenie, dopasuj do ekranu, 100%"],
          ["Ctrl + S", "Zapisz teraz"],
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
          "Element wyświetla się jako czerwony znak zapytania — pochodzi z rozszerzonego pakietu (zaloguj się, aby go zobaczyć) albo odwołuje się do usuniętego pliku.",
          "Nie mogę kliknąć elementu — prawdopodobnie jego warstwa lub on sam jest zablokowany. Sprawdź kłódki w panelu Warstwy.",
          "Eksport jest za duży — przeglądarki nie tworzą obrazów szerszych lub wyższych niż 16384 px. Wybierz mniejszą skalę.",
        ],
      },
    ],
  },
];
