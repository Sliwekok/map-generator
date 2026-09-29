import { getSessionUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { PREMIUM_ASSETS, PREMIUM_CATALOG, PREMIUM_PATTERNS } from "@/lib/assets/premium";

// Extended asset pack - SVG bodies are only delivered to logged-in users.
// Anonymous visitors receive a body-less catalog so the UI can show what they would unlock.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return json({ locked: true, catalog: PREMIUM_CATALOG, assets: [], patterns: [] });
  }
  return json(
    { locked: false, catalog: PREMIUM_CATALOG, assets: PREMIUM_ASSETS, patterns: PREMIUM_PATTERNS },
    { headers: { "Cache-Control": "private, max-age=600" } },
  );
}
