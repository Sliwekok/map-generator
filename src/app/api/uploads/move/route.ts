import { getSessionUser } from "@/lib/server/auth";
import { assertSameOrigin, error, folderIdParam, handler, idList, json, readJson } from "@/lib/server/http";
import { moveItems } from "@/lib/server/files";
import { LIMITS } from "@/lib/limits";

/** Moves files and folders: { fileIds: string[], folderIds: string[], targetId: string | null } */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const body = await readJson(req);
  const max = LIMITS.files.maxBatchItems;
  const fileIds = idList(body.fileIds, max, "fileIds");
  const folderIds = idList(body.folderIds, max, "folderIds");
  if (!("targetId" in body)) return error(400, "invalid_folder");
  const target = folderIdParam(body.targetId);
  return json(await moveItems(user.id, fileIds, folderIds, target));
});
