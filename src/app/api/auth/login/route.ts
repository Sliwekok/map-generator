import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/server/db";
import { User } from "@/lib/server/models";
import { setSessionCookie } from "@/lib/server/auth";
import { clientIp, error, handler, json, rateLimit } from "@/lib/server/http";

export const POST = handler(async (req: Request) => {
  if (!rateLimit(`login:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    return error(429, "Too many attempts, try again later");
  }
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) return error(400, "invalid_credentials");

  await connectDb();
  const user = await User.findOne({ email });
  // Always run bcrypt to keep timing similar whether or not the user exists.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2b$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok) return error(401, "invalid_credentials");

  const session = { id: user._id.toString(), email: user.email, name: user.name };
  await setSessionCookie(session);
  return json({ user: session });
});
