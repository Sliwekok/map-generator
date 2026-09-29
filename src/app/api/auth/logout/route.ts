import { clearSessionCookie } from "@/lib/server/auth";
import { json } from "@/lib/server/http";

export async function POST() {
  await clearSessionCookie();
  return json({ ok: true });
}
