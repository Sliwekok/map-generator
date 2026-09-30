import { getSessionUser } from "@/lib/server/auth";
import { assertSameOrigin, error, handler, idList, json, readJson } from "@/lib/server/http";
import { deleteItems } from "@/lib/server/files";
import { LIMITS } from "@/lib/limits";

/** Deletes files and folders (recursively): { fileIds: string[], folderIds: string[] } */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const body = await readJson(req);
  const max = LIMITS.files.maxBatchItems;
  return json(await deleteItems(user.id, idList(body.fileIds, max, "fileIds"), idList(body.folderIds, max, "folderIds")));
});
