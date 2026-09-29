import { connectDb } from "@/lib/server/db";
import { MapModel } from "@/lib/server/models";
import { getSessionUser } from "@/lib/server/auth";
import { error, handler, json } from "@/lib/server/http";
import { sanitizeMapContent } from "@/lib/mapContent";
import { LIMITS } from "@/lib/limits";
import { toMapDoc } from "@/lib/server/serialize";

// GET /api/maps            -> list of the user's maps (full documents, max 20, used for thumbnails)
export const GET = handler(async () => {
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  await connectDb();
  const docs = await MapModel.find({ owner: user.id }).sort({ updatedAt: -1 }).lean();
  return json({
    maps: docs.map((d) => toMapDoc(d as never)),
    limit: LIMITS.user.maxMaps,
  });
});

// POST /api/maps  { content }  -> create
export const POST = handler(async (req: Request) => {
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const text = await req.text();
  if (text.length > LIMITS.map.maxPayloadBytes) return error(413, "payload_too_large");
  let content;
  try {
    content = sanitizeMapContent(JSON.parse(text)?.content);
  } catch (e) {
    return error(400, (e as Error).message);
  }
  await connectDb();
  const count = await MapModel.countDocuments({ owner: user.id });
  if (count >= LIMITS.user.maxMaps) {
    return error(403, "map_limit", { limit: LIMITS.user.maxMaps });
  }
  const doc = await MapModel.create({ ...content, owner: user.id, revision: 1 });
  return json({ map: toMapDoc(doc.toObject() as never) }, 201);
});
