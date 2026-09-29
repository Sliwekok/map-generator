"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { useSession } from "@/lib/client/session";
import { cx } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";

// Language names are shown in their own language so they're recognisable whatever the current UI language.
const LANG_NAMES: Record<Lang, string> = { en: "English", pl: "Polski" };

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-slate-900 p-6 ring-1 ring-slate-800">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
        <Icon name={icon} size={18} className="text-amber-400" /> {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user } = useSession();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <header>
        <h1 className="font-display text-4xl font-bold text-slate-50">{t("settings.title")}</h1>
        <p className="mt-2 text-slate-400">{t("settings.intro")}</p>
      </header>

      <Section icon="globe" title={t("settings.language")}>
        <div role="radiogroup" aria-label={t("settings.language")} className="grid gap-3 sm:grid-cols-2">
          {LANGS.map((l) => {
            const active = lang === l;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={active}
                lang={l}
                onClick={() => setLang(l)}
                className={cx(
                  "flex items-center justify-between rounded-xl px-4 py-3 text-left ring-1 transition-colors",
                  active ? "bg-amber-500/10 ring-amber-500" : "bg-slate-800 ring-slate-700 hover:ring-slate-500",
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cx(
                      "rounded-md px-1.5 py-0.5 text-xs font-bold uppercase",
                      active ? "bg-amber-500 text-slate-950" : "bg-slate-700 text-slate-300",
                    )}
                  >
                    {l}
                  </span>
                  <span className="font-medium text-slate-100">{LANG_NAMES[l]}</span>
                </span>
                {active && <Icon name="check" size={18} className="text-amber-400" />}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-slate-500">{t("settings.languageHint")}</p>
      </Section>

      <Section icon={user ? "cloud" : "laptop"} title={t("settings.account")}>
        {user ? (
          <div className="space-y-1">
            <p className="font-medium text-slate-100">{t("settings.signedInAs", { name: user.name })}</p>
            <p className="text-sm text-slate-400">{user.email}</p>
            <p className="pt-2 text-sm text-slate-500">{t("settings.storageCloud")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-medium text-slate-100">{t("settings.guestTitle")}</p>
              <p className="mt-1 text-sm text-slate-400">{t("settings.guestText")}</p>
            </div>
            <div className="flex gap-2">
              <Link href="/register" className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
                {t("nav.register")}
              </Link>
              <Link href="/login" className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600">
                {t("nav.login")}
              </Link>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
