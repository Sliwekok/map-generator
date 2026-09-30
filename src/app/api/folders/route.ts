import { getSessionUser } from "@/lib/server/auth";
import { assertSameOrigin, error, folderIdParam, handler, json, rateLimit, readJson } from "@/lib/server/http";
import { createFolder } from "@/lib/server/files";

/** Creates a folder: { name, parentId: string | null } */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  if (!rateLimit(`folders:${user.id}`, 120, 60_000)) return error(429, "rate_limited");
  const body = await readJson(req);
  const folder = await createFolder(user.id, body.name, folderIdParam(body.parentId));
  return json({ folder }, 201);
});
