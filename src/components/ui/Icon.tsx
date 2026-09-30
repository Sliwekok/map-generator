// Minimal inline stroke icon set (24x24, currentColor).
const P: Record<string, string> = {
  select: "M5 3l14 8-6 1.5L10 19z",
  hand: "M8 12V5.5a1.5 1.5 0 013 0V11m0-6.5v-1a1.5 1.5 0 013 0V11m0-5.5a1.5 1.5 0 013 0V13a7 7 0 01-7 7h-.5a6 6 0 01-4.9-2.5L4 14.5a1.6 1.6 0 012.5-2L8 14",
  text: "M5 6V4h14v2M12 4v16M9 20h6",
  rect: "M4 5h16v14H4z",
  ellipse: "M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z",
  pen: "M4 20c3-1 4-4 6-7s5-6 7-6 3 2 1 4-6 3-8 6-2 3-6 3z",
  ruler: "M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3",
  zoomIn: "M11 4a7 7 0 110 14 7 7 0 010-14zM21 21l-5-5M11 8v6M8 11h6",
  zoomOut: "M11 4a7 7 0 110 14 7 7 0 010-14zM21 21l-5-5M8 11h6",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  grid: "M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16",
  magnet: "M6 4v7a6 6 0 0012 0V4h-4v7a2 2 0 01-4 0V4zM6 8h4M14 8h4",
  settings: "M12 9a3 3 0 110 6 3 3 0 010-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 14l5-5 5 5M5 4h14",
  help: "M12 21a9 9 0 110-18 9 9 0 010 18zM9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 018 0v3",
  unlock: "M6 11h12v9H6zM8 11V8a4 4 0 017.5-2",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 110 6 3 3 0 010-6z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3 3.7M6.6 6.6A17 17 0 002 12s4 7 10 7a9.6 9.6 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2",
  flipH: "M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z",
  flipV: "M3 12h18M7 8l5-5 5 5zM7 16l5 5 5-5z",
  rotL: "M4 4v5h5M4.6 13A8 8 0 104 9",
  rotR: "M20 4v5h-5M19.4 13A8 8 0 1120 9",
  front: "M8 8h12v12H8zM4 16V4h12",
  back: "M4 4h12v12H4zM20 8v12H8",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  check: "M5 12l5 5L20 7",
  cloud: "M7 18a4 4 0 01-.5-8A6 6 0 0118 9a4.5 4.5 0 01-.5 9z",
  laptop: "M5 5h14v10H5zM2 19h20",
  x: "M6 6l12 12M18 6L6 18",
  alignL: "M4 3v18M8 7h10v4H8zM8 14h6v4H8z",
  alignCH: "M12 3v18M6 7h12v4H6zM8 14h8v4H8z",
  alignR: "M20 3v18M6 7h10v4H6zM10 14h6v4h-6z",
  alignT: "M3 4h18M7 8h4v10H7zM14 8h4v6h-4z",
  alignM: "M3 12h18M7 6h4v12H7zM14 8h4v8h-4z",
  alignB: "M3 20h18M7 6h4v10H7zM14 10h4v6h-4z",
  distH: "M4 3v18M20 3v18M9 8h6v8H9z",
  distV: "M3 4h18M3 20h18M8 9h8v6H8z",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z",
  menu: "M4 6h16M4 12h16M4 18h16",
  globe: "M12 21a9 9 0 110-18 9 9 0 010 18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
  scaleUp: "M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7",
  scaleDown: "M10 4v6H4M14 20v-6h6M10 10L3 3M14 14l7 7",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  cut: "M6 4a3 3 0 110 6 3 3 0 010-6zM6 14a3 3 0 110 6 3 3 0 010-6zM8.6 8.5L20 18M8.6 15.5L20 6",
  paste: "M9 4h6v3H9zM9 5H6v15h12V5h-3",
  duplicate: "M8 8h12v12H8zM4 16V4h12M14 11v6M11 14h6",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  folder: "M3 6.5A1.5 1.5 0 014.5 5H9l2 2.5h8.5A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5z",
  folderPlus: "M3 6.5A1.5 1.5 0 014.5 5H9l2 2.5h8.5A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5zM12 11v6M9 14h6",
  folderMove: "M3 6.5A1.5 1.5 0 014.5 5H9l2 2.5h8.5A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5zM8 14h8M13 11l3 3-3 3",
  pencil: "M4 20l4.5-1L19 8.5 15.5 5 5 15.5zM13.5 7l3.5 3.5",
  archive: "M4 4h16v4H4zM5 8v12h14V8M10 12h4",
  search: "M11 4a7 7 0 110 14 7 7 0 010-14zM21 21l-5-5",
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  brush: "M19 3.5a1.8 1.8 0 012.5 2.5L13 14.5 10.5 12zM9.5 13l2.5 2.5c-.4 2.9-2.6 5-7.5 5 1.2-1.3 1.2-2.8 1.6-4.2.5-1.8 1.9-3.3 3.4-3.3z",
  eraser: "M15.5 4l5.5 5.5-9 9H7l-4-4zM10 20h11M9 10.5l5.5 5.5",
};

export function Icon({ name, size = 18, className }: { name: keyof typeof P | string; size?: number; className?: string }) {
  const d = P[name] ?? P.x;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
