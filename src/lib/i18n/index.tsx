"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import en, { type Dict } from "./en";
import pl from "./pl";

import { LANG_COOKIE, LANGS, type Lang } from "./config";
export { LANG_COOKIE, LANGS, type Lang };

const DICTS: Record<Lang, Dict> = { en, pl };

// "a.b.c" key paths of the dictionary, so t() calls are type-checked.
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Paths<Dict>;

function lookup(dict: Dict, key: string): string {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[part];
    else return key;
  }
  return typeof cur === "string" ? cur : key;
}

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s = lookup(DICTS[lang], key);
  if (s === key && lang !== "en") s = lookup(en, key);
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, v) => (v in vars ? String(vars[v]) : m));
  return s;
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const channel = useRef<BroadcastChannel | null>(null);

  // Keep every open tab in sync, e.g. the editor while the language is changed on /settings in another tab.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(LANG_COOKIE);
    ch.onmessage = (e: MessageEvent) => {
      const l = e.data as Lang;
      if (!LANGS.includes(l)) return;
      setLangState(l);
      document.documentElement.lang = l;
    };
    channel.current = ch;
    return () => {
      ch.close();
      channel.current = null;
    };
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    channel.current?.postMessage(l);
  }, []);
  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
