import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/server/db";
import { User } from "@/lib/server/models";
import { setSessionCookie } from "@/lib/server/auth";
import { clientIp, error, handler, json, rateLimit } from "@/lib/server/http";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const POST = handler(async (req: Request) => {
  if (!rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return error(429, "Too many attempts, try again later");
  }
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const name = String(body?.name ?? "").trim().slice(0, 60) || email.split("@")[0];

  if (!EMAIL_RE.test(email) || email.length > 200) return error(400, "invalid_email");
  if (password.length < 8 || password.length > 200) return error(400, "weak_password");

  await connectDb();
  if (await User.exists({ email })) return error(409, "email_taken");

  const passwordHash = await bcrypt.hash(password, 11);
  const user = await User.create({ email, name, passwordHash });
  const session = { id: user._id.toString(), email: user.email, name: user.name };
  await setSessionCookie(session);
  return json({ user: session }, 201);
});
