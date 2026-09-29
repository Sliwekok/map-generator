import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { LANG_COOKIE, type Lang } from "@/lib/i18n/config";
import { SessionProvider } from "@/lib/client/session";
import { getSessionUser } from "@/lib/server/auth";
import Toasts from "@/components/Toasts";

export const metadata: Metadata = {
  title: "MapForge — TTRPG battle map creator",
  description: "Create vector battle maps for D&D and other tabletop RPGs. Grid, drag & drop assets, custom uploads, export to PNG/SVG.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const cookieLang = jar.get(LANG_COOKIE)?.value;
  const lang: Lang = cookieLang === "pl" || cookieLang === "en" ? cookieLang : "en";
  const user = await getSessionUser();

  return (
    <html lang={lang} className="h-full antialiased">
      <body className="min-h-full">
        <I18nProvider initialLang={lang}>
          <SessionProvider initialUser={user}>
            {children}
            <Toasts />
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
