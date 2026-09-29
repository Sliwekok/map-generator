"use client";

import { LANGS, useI18n } from "@/lib/i18n";
import { cx } from "@/components/ui/controls";

export default function LangSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="inline-flex rounded-lg bg-slate-800 p-0.5 ring-1 ring-slate-700" role="group" aria-label={t("nav.language")}>
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cx(
            "rounded-md font-semibold uppercase transition-colors",
            compact ? "px-1.5 py-1 text-[10px]" : "px-2 py-1 text-xs",
            lang === l ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white",
          )}
          aria-pressed={lang === l}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
