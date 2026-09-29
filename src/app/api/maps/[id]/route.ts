import { connectDb } from "@/lib/server/db";
import { MapModel } from "@/lib/server/models";
import { getSessionUser } from "@/lib/server/auth";
import { error, handler, isObjectId, json } from "@/lib/server/http";
import { sanitizeMapContent } from "@/lib/mapContent";
import { LIMITS } from "@/lib/limits";
import { toMapDoc } from "@/lib/server/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const { id } = await params;
  if (!isObjectId(id)) return error(404, "not_found");
  await connectDb();
  const doc = await MapModel.findOne({ _id: id, owner: user.id }).lean();
  if (!doc) return error(404, "not_found");
  return json({ map: toMapDoc(doc as never) });
});

/**
 * Autosave endpoint.
 * Body: { baseRevision: number, content: MapContent, force?: boolean }
 * Uses optimistic concurrency: the update only applies when the stored revision equals
 * baseRevision, so two tabs editing the same map cannot silently overwrite each other.
 */
export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const { id } = await params;
  if (!isObjectId(id)) return error(404, "not_found");
  const text = await req.text();
  if (text.length > LIMITS.map.maxPayloadBytes) return error(413, "payload_too_large");
  let body: { baseRevision?: number; content?: unknown; force?: boolean };
  let content;
  try {
    body = JSON.parse(text);
    content = sanitizeMapContent(body.content);
  } catch (e) {
    return error(400, (e as Error).message);
  }
  await connectDb();
  const filter: Record<string, unknown> = { _id: id, owner: user.id };
  if (!body.force) filter.revision = Number(body.baseRevision ?? -1);

  const updated = await MapModel.findOneAndUpdate(
    filter,
    { $set: content, $inc: { revision: 1 } },
    { returnDocument: "after" },
  ).lean();

  if (!updated) {
    const current = await MapModel.findOne({ _id: id, owner: user.id }, { revision: 1 }).lean();
    if (!current) return error(404, "not_found");
    return error(409, "conflict", { revision: current.revision });
  }
  return json({ revision: updated.revision, updatedAt: new Date(updated.updatedAt).toISOString() });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const { id } = await params;
  if (!isObjectId(id)) return error(404, "not_found");
  await connectDb();
  const res = await MapModel.deleteOne({ _id: id, owner: user.id });
  if (res.deletedCount === 0) return error(404, "not_found");
  return json({ ok: true });
});
