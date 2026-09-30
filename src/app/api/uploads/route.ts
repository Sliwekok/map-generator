import { getSessionUser } from "@/lib/server/auth";
import { assertSameOrigin, error, folderIdParam, handler, json, rateLimit } from "@/lib/server/http";
import { extractArchive, listFolder, searchFiles, uploadImage } from "@/lib/server/files";
import { LIMITS } from "@/lib/limits";
import { fileKind } from "@/lib/fileNames";
import { detectArchive } from "@/lib/server/archive";

/**
 * Lazy listing - the client asks only for what it shows:
 *   GET /api/uploads?folder=<id|root>  -> contents of one folder (FolderListing)
 *   GET /api/uploads?q=<text>          -> search over all names (FileSearchResult)
 */
export const GET = handler(async (req: Request) => {
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  const params = new URL(req.url).searchParams;
  const q = params.get("q");
  if (q !== null) {
    if (q.length > 100) return error(400, "query_too_long");
    return json(await searchFiles(user.id, q));
  }
  const listing = await listFolder(user.id, folderIdParam(params.get("folder")));
  return json({ ...listing, limits: LIMITS_INFO });
});

const LIMITS_INFO = {
  maxFiles: LIMITS.user.maxUploads,
  maxBytes: LIMITS.user.maxUploadBytes,
  maxStorageBytes: LIMITS.user.maxStorageBytes,
  maxArchiveBytes: LIMITS.files.maxArchiveBytes,
  maxFolders: LIMITS.files.maxFolders,
  maxFolderDepth: LIMITS.files.maxFolderDepth,
};

// POST multipart/form-data: file (image or .zip/.tar/.tar.gz archive), folderId? (empty = root)
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const user = await getSessionUser();
  if (!user) return error(401, "unauthorized");
  if (!rateLimit(`upload:${user.id}`, 120, 60_000)) return error(429, "rate_limited");

  // Reject oversized bodies before buffering them.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > LIMITS.files.maxArchiveBytes + 64 * 1024) {
    return error(413, "archive_too_large", { maxBytes: LIMITS.files.maxArchiveBytes });
  }
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return error(415, "multipart_required");
  }
  const form = await req.formData().catch(() => null);
  if (!form) return error(400, "invalid_form");
  const files = form.getAll("file");
  if (files.length !== 1 || !(files[0] instanceof File)) return error(400, "no_file");
  const file = files[0];
  const folderId = folderIdParam(form.get("folderId"));
  const name = typeof file.name === "string" ? file.name : "upload";

  // Size limits depend on what the file claims to be; the content decides what it is.
  const kind = fileKind(name);
  if (file.size === 0) return error(422, "empty_file");
  if (kind === "archive" && file.size > LIMITS.files.maxArchiveBytes) {
    return error(413, "archive_too_large", { maxBytes: LIMITS.files.maxArchiveBytes });
  }
  if (kind !== "archive" && file.size > LIMITS.user.maxUploadBytes) {
    return error(413, "file_too_large", { maxBytes: LIMITS.user.maxUploadBytes });
  }
  const bytes = Buffer.from(await file.arrayBuffer());

  if (kind === "archive") {
    if (!detectArchive(bytes)) return error(415, "unsupported_type");
    const result = await extractArchive(user.id, bytes, folderId);
    return json(result, 201);
  }
  // Anything else must really be an image, whatever its extension says.
  const result = await uploadImage(user.id, name, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), folderId);
  return json(result, 201);
});
