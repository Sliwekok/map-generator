"use client";

import { useToasts } from "@/lib/client/toasts";
import { cx } from "@/components/ui/controls";

export default function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-10 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cx(
            "pointer-events-auto rounded-lg px-4 py-2 text-sm shadow-lg ring-1",
            t.kind === "error" && "bg-red-900 text-red-50 ring-red-700",
            t.kind === "success" && "bg-emerald-900 text-emerald-50 ring-emerald-700",
            t.kind === "info" && "bg-slate-800 text-slate-100 ring-slate-600",
          )}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
