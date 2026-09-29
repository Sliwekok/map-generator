import type { TextElement } from "@/lib/types";

export const FONT_STACKS: Record<TextElement["fontFamily"], string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "system-ui, 'Segoe UI', Arial, sans-serif",
  mono: "ui-monospace, Consolas, 'Courier New', monospace",
  fantasy: "Papyrus, Luminari, 'Trattatello', fantasy",
};

export const LINE_HEIGHT = 1.2;

let ctx: CanvasRenderingContext2D | null = null;

/** Measures the box of a text element (multi-line). Falls back to an estimate on the server. */
export function measureText(el: Pick<TextElement, "text" | "fontSize" | "fontFamily" | "bold" | "italic">) {
  const lines = (el.text || " ").split("\n");
  const height = lines.length * el.fontSize * LINE_HEIGHT;
  if (typeof document === "undefined") {
    const longest = Math.max(...lines.map((l) => l.length));
    return { width: Math.max(el.fontSize, longest * el.fontSize * 0.6), height };
  }
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return { width: el.fontSize * 4, height };
  ctx.font = `${el.italic ? "italic " : ""}${el.bold ? "bold " : ""}${el.fontSize}px ${FONT_STACKS[el.fontFamily]}`;
  const width = Math.max(...lines.map((l) => ctx!.measureText(l || " ").width));
  return { width: Math.max(el.fontSize * 0.5, Math.ceil(width + el.fontSize * 0.1)), height };
}

/** Re-computes width/height of a text element after its text or font changed (keeps center). */
export function relayoutText(el: TextElement): TextElement {
  const { width, height } = measureText(el);
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return { ...el, width, height, x: cx - width / 2, y: cy - height / 2 };
}
