"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/client/session";
import { cx } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="6" fill="#f59e0b" />
      <path d="M8 22V10l5 5 3-6 3 6 5-5v12z" fill="#0f172a" />
      <path d="M8 25h16" stroke="#0f172a" strokeWidth="2" />
    </svg>
  );
}

export default function Navbar() {
  const { t } = useI18n();
  const { user, logout } = useSession();
  const path = usePathname();
  const router = useRouter();
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={cx(
        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        path === href ? "bg-slate-800 text-amber-400" : "text-slate-300 hover:text-white",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="mr-4 flex items-center gap-2">
          <Logo />
          <span className="font-display text-xl font-bold tracking-wide text-amber-400">MapForge</span>
        </Link>
        <div className="hidden items-center gap-1 sm:flex">
          {link("/", t("nav.home"))}
          {link("/maps", t("nav.maps"))}
          {user && link("/files", t("nav.files"))}
          {link("/help", t("nav.help"))}
        </div>
        <div className="flex-1" />
        <Link
          href="/settings"
          title={t("nav.settings")}
          aria-label={t("nav.settings")}
          className={cx(
            "rounded-lg p-2 transition-colors",
            path === "/settings" ? "bg-slate-800 text-amber-400" : "text-slate-300 hover:text-white",
          )}
        >
          <Icon name="sliders" size={18} />
        </Link>
        {user ? (
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 text-sm text-slate-300 md:flex">
              <Icon name="cloud" size={16} /> {user.name}
            </span>
            <button
              onClick={async () => {
                await logout();
                router.push("/");
                router.refresh();
              }}
              className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              {t("nav.logout")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white">
              {t("nav.login")}
            </Link>
            <Link href="/register" className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
              {t("nav.register")}
            </Link>
          </div>
        )}
      </div>
      <div className="flex gap-1 px-4 pb-2 sm:hidden">
        {link("/", t("nav.home"))}
        {link("/maps", t("nav.maps"))}
        {user && link("/files", t("nav.files"))}
        {link("/help", t("nav.help"))}
      </div>
    </nav>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
      {t("footer.text")} · <Link href="/help" className="hover:text-slate-300">{t("nav.help")}</Link>
    </footer>
  );
}
