import { getSessionUser } from "@/lib/server/auth";
import { assertSameOrigin, error, handler, idList, json, readJson } from "@/lib/server/http";
import { lookupFiles } from "@/lib/server/files";
import { LIMITS } from "@/lib/limits";

/** Metadata for specific files: { ids: string[] } -> { uploads, missing } (owner-scoped). */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const body = await readJson(req);
  return json(await lookupFiles(user.id, idList(body.ids, LIMITS.files.maxBatchItems, "ids")));
});
