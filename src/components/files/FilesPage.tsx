"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/client/session";
import { useUploads } from "@/lib/client/uploads";
import { Icon } from "@/components/ui/Icon";
import FileBrowser from "./FileBrowser";

export default function FilesPage() {
  const { t } = useI18n();
  const { user } = useSession();

  useEffect(() => {
    void useUploads.getState().load(user);
  }, [user]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-100">{t("files.title")}</h1>
        <p className="mt-2 max-w-3xl text-slate-400">{t("files.intro")}</p>
      </header>
      {user ? (
        <FileBrowser variant="page" />
      ) : (
        <div className="max-w-xl rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-amber-100" data-testid="files-login">
          <div className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <Icon name="lock" size={18} /> {t("files.loginTitle")}
          </div>
          <p className="mb-4 text-sm">{t("files.loginText")}</p>
          <div className="flex gap-2">
            <Link href="/login" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950">
              {t("nav.login")}
            </Link>
            <Link href="/register" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-100">
              {t("nav.register")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
