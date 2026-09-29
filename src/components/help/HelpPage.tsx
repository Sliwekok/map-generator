"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { HELP_EN, HELP_PL, type Block } from "./content";

function renderBlock(b: Block, i: number) {
  if (typeof b === "string") return <p key={i} className="leading-relaxed text-slate-300">{b}</p>;
  if ("list" in b)
    return (
      <ul key={i} className="list-disc space-y-2 pl-5 leading-relaxed text-slate-300 marker:text-amber-500">
        {b.list.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    );
  if ("tip" in b)
    return (
      <div key={i} className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
        <Icon name="help" size={18} className="mt-0.5 shrink-0" /> {b.tip}
      </div>
    );
  return (
    <div key={i} className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {b.keys.map(([k, d]) => (
            <tr key={k} className="border-b border-slate-800">
              <td className="py-2 pr-4 align-top">
                <kbd className="whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-amber-200 ring-1 ring-slate-700">{k}</kbd>
              </td>
              <td className="py-2 text-slate-300">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HelpPage() {
  const { t, lang } = useI18n();
  const sections = lang === "pl" ? HELP_PL : HELP_EN;
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("help.toc")}</h2>
        <nav className="flex flex-wrap gap-1 lg:flex-col">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-amber-400">
              {s.title}
            </a>
          ))}
        </nav>
      </aside>
      <article className="prose-help min-w-0">
        <h1 className="font-display text-4xl font-bold text-slate-50">{t("help.title")}</h1>
        <p className="mt-2 text-lg text-slate-400">{t("help.intro")}</p>
        <Link href="/maps?new=1" className="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
          {t("home.ctaStart")}
        </Link>
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 border-t border-slate-800 pt-8 mt-8">
            <h2 className="mb-4 text-2xl font-bold text-slate-100">{s.title}</h2>
            <div className="space-y-4">{s.blocks.map(renderBlock)}</div>
          </section>
        ))}
      </article>
    </div>
  );
}
