import mongoose from "mongoose";
import { getSessionUser } from "@/lib/server/auth";
import { uploadsBucket, type UploadMeta } from "@/lib/server/gridfs";
import { assertSameOrigin, error, handler, isObjectId, json, readJson } from "@/lib/server/http";
import { deleteItems, renameFile } from "@/lib/server/files";

type Ctx = { params: Promise<{ id: string }> };

async function findOwned(id: string, owner: string) {
  const bucket = await uploadsBucket();
  const oid = new mongoose.Types.ObjectId(id);
  const [file] = await bucket.find({ _id: oid, "metadata.owner": owner }).limit(1).toArray();
  return { bucket, oid, file: file as unknown as { length: number; metadata: UploadMeta } | undefined };
}

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const { id } = await params;
  if (!isObjectId(id)) return error(404, "not_found");
  const { bucket, oid, file } = await findOwned(id, user.id);
  if (!file) return error(404, "not_found");

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    bucket
      .openDownloadStream(oid)
      .on("data", (c: Buffer) => chunks.push(c))
      .on("error", reject)
      .on("end", () => resolve());
  });
  return new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: {
      "Content-Type": file.metadata.contentType,
      "Content-Length": String(file.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.metadata.originalName ?? "file")}`,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Uploaded SVGs must never run scripts even if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    },
  });
});

/** Rename: { name } */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const { id } = await params;
  if (!isObjectId(id)) return error(404, "not_found");
  const body = await readJson(req);
  const upload = await renameFile(user.id, id.toLowerCase(), body.name);
  return json({ upload });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const { id } = await params;
  if (!isObjectId(id)) return error(404, "not_found");
  await deleteItems(user.id, [id.toLowerCase()], []);
  return json({ ok: true });
});
