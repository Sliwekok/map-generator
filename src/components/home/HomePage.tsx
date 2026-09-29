"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
import { FREE_ASSETS, FREE_PATTERNS } from "@/lib/assets/free";
import { MapRenderer } from "@/components/map/MapRenderer";
import { Icon } from "@/components/ui/Icon";
import { demoMap } from "./demoMap";

const assets = Object.fromEntries(FREE_ASSETS.map((a) => [a.id, a]));
const patterns = Object.fromEntries(FREE_PATTERNS.map((p) => [p.id, p]));
const PREMIUM_COUNT = 36;

export default function HomePage() {
  const { t } = useI18n();
  const demo = useMemo(() => demoMap(t("home.demoLabel")), [t]);

  const features: { icon: string; title: TKey; text: TKey }[] = [
    { icon: "scaleUp", title: "home.f1t", text: "home.f1d" },
    { icon: "grid", title: "home.f2t", text: "home.f2d" },
    { icon: "image", title: "home.f3t", text: "home.f3d" },
    { icon: "select", title: "home.f4t", text: "home.f4d" },
    { icon: "cloud", title: "home.f5t", text: "home.f5d" },
    { icon: "layers", title: "home.f6t", text: "home.f6d" },
  ];

  const plan = (title: string, items: string, highlight?: boolean) => (
    <div className={`rounded-2xl p-6 ring-1 ${highlight ? "bg-amber-500/10 ring-amber-500" : "bg-slate-800/60 ring-slate-700"}`}>
      <h3 className="mb-4 font-display text-2xl font-bold text-slate-100">{title}</h3>
      <ul className="space-y-2">
        {items.split("|").map((i) => (
          <li key={i} className="flex gap-2 text-slate-300">
            <Icon name="check" size={18} className="mt-0.5 shrink-0 text-amber-400" /> {i}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.18),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight text-slate-50 md:text-5xl">{t("home.heroTitle")}</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">{t("home.heroText")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/maps?new=1" className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400">
                {t("home.ctaStart")}
              </Link>
              <Link href="/help" className="rounded-xl bg-slate-800 px-6 py-3 font-semibold text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700">
                {t("home.ctaHelp")}
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">{t("home.noAccount", { n: LIMITS.anonymous.maxMaps })}</p>
          </div>
          <figure className="rounded-2xl bg-slate-800 p-3 shadow-2xl ring-1 ring-slate-700">
            <svg viewBox={`0 0 ${demo.width} ${demo.height}`} className="w-full rounded-lg" role="img" aria-label={t("home.demoTitle")}>
              <MapRenderer doc={demo} idPrefix="demo" showGrid assets={assets} patterns={patterns} uploads={{}} />
            </svg>
            <figcaption className="mt-2 text-center text-xs text-slate-500">{t("home.demoText")}</figcaption>
          </figure>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-10 text-center font-display text-3xl font-bold text-slate-100">{t("home.featuresTitle")}</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl bg-slate-800/60 p-6 ring-1 ring-slate-700 transition hover:ring-amber-500/60">
              <div className="mb-4 inline-flex rounded-xl bg-amber-500/15 p-3 text-amber-400">
                <Icon name={f.icon} size={24} />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-100">{t(f.title)}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{t(f.text)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* asset strip */}
      <section className="border-y border-slate-800 bg-slate-900/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-3 px-4">
          {FREE_ASSETS.map((a) => (
            <div key={a.id} className="h-16 w-16 rounded-lg bg-[#e8dcc0] p-2 ring-1 ring-slate-700" title={a.name.en}>
              <svg viewBox={a.viewBox} className="h-full w-full" style={{ color: a.defaultTint }}>
                <g dangerouslySetInnerHTML={{ __html: a.body }} />
              </svg>
            </div>
          ))}
        </div>
      </section>

      {/* plans */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="mb-8 text-center font-display text-3xl font-bold text-slate-100">{t("home.plansTitle")}</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {plan(
            t("home.guestPlan"),
            t("home.guestItems", { maps: LIMITS.anonymous.maxMaps, assets: FREE_ASSETS.length, uploads: LIMITS.anonymous.maxUploads }),
          )}
          {plan(
            t("home.userPlan"),
            t("home.userItems", { maps: LIMITS.user.maxMaps, premium: PREMIUM_COUNT, uploads: LIMITS.user.maxUploads }),
            true,
          )}
        </div>
        <div className="mt-10 text-center">
          <Link href="/register" className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-slate-950 hover:bg-amber-400">
            {t("nav.register")}
          </Link>
        </div>
      </section>
    </div>
  );
}
