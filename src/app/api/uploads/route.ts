import mongoose from "mongoose";
import { getSessionUser } from "@/lib/server/auth";
import { uploadsBucket, type UploadMeta } from "@/lib/server/gridfs";
import { error, handler, json } from "@/lib/server/http";
import { LIMITS } from "@/lib/limits";
import { sanitizeSvg, sniffImageType, svgSize } from "@/lib/uploadCheck";
import type { UploadInfo } from "@/lib/types";

type FileDoc = { _id: mongoose.Types.ObjectId; length: number; metadata?: UploadMeta };

function toInfo(f: FileDoc): UploadInfo {
  const id = f._id.toString();
  return {
    id,
    name: f.metadata?.originalName ?? "upload",
    contentType: f.metadata?.contentType ?? "application/octet-stream",
    width: f.metadata?.width ?? 256,
    height: f.metadata?.height ?? 256,
    size: f.length,
    source: "cloud",
    url: `/api/uploads/${id}`,
  };
}

export const GET = handler(async () => {
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const bucket = await uploadsBucket();
  const files = (await bucket.find({ "metadata.owner": user.id }).sort({ uploadDate: -1 }).toArray()) as unknown as FileDoc[];
  return json({ uploads: files.map(toInfo), limit: LIMITS.user.maxUploads, maxBytes: LIMITS.user.maxUploadBytes });
});

// POST multipart/form-data: file, width?, height?
export const POST = handler(async (req: Request) => {
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return error(400, "no_file");
  if (file.size > LIMITS.user.maxUploadBytes) return error(413, "file_too_large", { maxBytes: LIMITS.user.maxUploadBytes });

  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return error(415, "unsupported_type");

  let width = Math.round(Number(form?.get("width")) || 0);
  let height = Math.round(Number(form?.get("height")) || 0);
  if (type === "image/svg+xml") {
    const text = sanitizeSvg(new TextDecoder().decode(bytes));
    bytes = new TextEncoder().encode(text);
    const s = svgSize(text);
    if (s && (!width || !height)) ({ width, height } = { width: Math.round(s.width), height: Math.round(s.height) });
  }
  width = Math.min(Math.max(width || 256, 1), 20000);
  height = Math.min(Math.max(height || 256, 1), 20000);

  const bucket = await uploadsBucket();
  const count = (await bucket.find({ "metadata.owner": user.id }).toArray()).length;
  if (count >= LIMITS.user.maxUploads) return error(403, "upload_limit", { limit: LIMITS.user.maxUploads });

  const meta: UploadMeta = {
    owner: user.id,
    contentType: type,
    width,
    height,
    originalName: file.name.slice(0, 120) || "upload",
  };
  const id = await new Promise<mongoose.Types.ObjectId>((resolve, reject) => {
    const stream = bucket.openUploadStream(meta.originalName, { metadata: meta });
    stream.once("finish", () => resolve(stream.id as mongoose.Types.ObjectId));
    stream.once("error", reject);
    stream.end(Buffer.from(bytes));
  });
  return json({ upload: toInfo({ _id: id, length: bytes.length, metadata: meta }) }, 201);
});
