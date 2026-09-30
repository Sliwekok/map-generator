import { getSessionUser } from "@/lib/server/auth";
import { assertSameOrigin, error, handler, isObjectId, json, readJson } from "@/lib/server/http";
import { deleteItems, renameFolder } from "@/lib/server/files";

type Ctx = { params: Promise<{ id: string }> };

/** Rename: { name } */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const { id } = await params;
  if (!isObjectId(id)) return error(404, "folder_not_found");
  const body = await readJson(req);
  return json({ folder: await renameFolder(user.id, id.toLowerCase(), body.name) });
});

/** Deletes the folder with everything inside it. */
export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const { id } = await params;
  if (!isObjectId(id)) return error(404, "folder_not_found");
  return json(await deleteItems(user.id, [], [id.toLowerCase()]));
});
