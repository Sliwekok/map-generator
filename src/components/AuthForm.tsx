"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useSession } from "@/lib/client/session";
import { api, ApiError } from "@/lib/client/api";
import { LIMITS } from "@/lib/limits";
import type { SessionUser } from "@/lib/types";
import { Button } from "@/components/ui/controls";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t } = useI18n();
  const { setUser } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ user: SessionUser }>(`/api/auth/${mode}`, {
        method: "POST",
        json: mode === "register" ? { email, password, name } : { email, password },
      });
      setUser(r.user);
      router.push("/maps");
      router.refresh();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      const known = ["invalid_email", "weak_password", "email_taken", "invalid_credentials"];
      if (known.includes(code)) setErr(t(`auth.errors.${code}` as TKey));
      else if (e instanceof ApiError && e.status === 503) setErr(t("common.dbUnavailable"));
      else if (e instanceof ApiError && e.status === 429) setErr(code);
      else setErr(t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-lg bg-slate-900 px-3 py-2.5 text-slate-100 ring-1 ring-slate-700 outline-none focus:ring-amber-500";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <form onSubmit={submit} className="rounded-2xl bg-slate-800 p-8 shadow-xl ring-1 ring-slate-700">
        <h1 className="mb-2 font-display text-3xl font-bold text-slate-100">
          {mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
        </h1>
        <p className="mb-6 text-sm text-slate-400">{t("auth.perks", { maps: LIMITS.user.maxMaps })}</p>
        {mode === "register" && (
          <label className="mb-4 block">
            <span className="mb-1 block text-sm text-slate-300">{t("auth.name")}</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="nickname" />
          </label>
        )}
        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-slate-300">{t("auth.email")}</span>
          <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="mb-2 block">
          <span className="mb-1 block text-sm text-slate-300">{t("auth.password")}</span>
          <input
            className={input}
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </label>
        {mode === "register" && <p className="mb-4 text-xs text-slate-500">{t("auth.passwordHint")}</p>}
        {err && (
          <p className="mb-4 rounded-md bg-red-900/50 px-3 py-2 text-sm text-red-200" role="alert">
            {err}
          </p>
        )}
        <Button type="submit" variant="primary" className="mt-2 w-full py-2.5" disabled={busy}>
          {mode === "login" ? t("auth.loginBtn") : t("auth.registerBtn")}
        </Button>
        <p className="mt-6 text-center text-sm text-slate-400">
          {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
          <Link href={mode === "login" ? "/register" : "/login"} className="font-semibold text-amber-400 hover:underline">
            {mode === "login" ? t("nav.register") : t("nav.login")}
          </Link>
        </p>
      </form>
    </div>
  );
}
