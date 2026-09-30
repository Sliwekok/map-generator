import "server-only";
// File-system logic for user uploads: folders, quotas, archive extraction, move, delete.
// Every function takes the owner id from the session - ids coming from the client are only
// ever used together with the owner filter, so users can never touch each other's files.
import mongoose from "mongoose";
import { LIMITS } from "@/lib/limits";
import { checkImage, type CheckedImage, type ImageCheckError } from "@/lib/uploadCheck";
import { fileKind, isSystemJunk, nameKey, sanitizeName, splitExt, uniqueName, validateName, withTypeExtension } from "@/lib/fileNames";
import type { FolderInfo, SkippedEntry, StorageUsage, UploadInfo, UploadResult } from "@/lib/types";
import { Folder, type FolderDocument } from "./models";
import { uploadsFiles, type UploadMeta } from "./gridfs";
import { ArchiveError, EntryError, readArchive } from "./archive";
import { HttpError } from "./http";

const { ObjectId } = mongoose.Types;
type OID = mongoose.Types.ObjectId;

export type FileDoc = { _id: OID; length: number; uploadDate?: Date; metadata?: UploadMeta };

// ---------------------------------------------------------------- serialisation

export function toUploadInfo(f: FileDoc): UploadInfo {
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
    folderId: f.metadata?.folderId ?? null,
    createdAt: (f.uploadDate ? new Date(f.uploadDate) : new Date()).toISOString(),
  };
}

export function toFolderInfo(f: Pick<FolderDocument, "_id" | "name" | "parent" | "createdAt">): FolderInfo {
  return {
    id: f._id.toString(),
    name: f.name,
    parentId: f.parent ?? null,
    createdAt: new Date(f.createdAt ?? Date.now()).toISOString(),
  };
}

// ---------------------------------------------------------------- per-user serialisation

// Mutations of one user's tree run one at a time (within this server process), so quota and
// duplicate-name checks cannot race. The unique index on folders is the cross-process backstop.
const locks = new Map<string, Promise<void>>();

export async function withUserLock<T>(owner: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(owner) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  const chain = prev.then(() => mine);
  locks.set(owner, chain);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(owner) === chain) locks.delete(owner);
  }
}

// ---------------------------------------------------------------- tree

export interface Tree {
  folders: Map<string, FolderDocument>;
  files: FileDoc[];
}

export async function loadTree(owner: string): Promise<Tree> {
  const { bucket } = await uploadsFiles();
  const [folders, files] = await Promise.all([
    Folder.find({ owner }).lean<FolderDocument[]>(),
    bucket.find({ "metadata.owner": owner }).sort({ uploadDate: -1 }).toArray() as unknown as Promise<FileDoc[]>,
  ]);
  const map = new Map<string, FolderDocument>();
  for (const f of folders) map.set(f._id.toString(), f);
  // Files pointing to a folder that no longer exists (e.g. interrupted delete) are shown in the root.
  for (const f of files) {
    if (f.metadata?.folderId && !map.has(f.metadata.folderId)) f.metadata.folderId = null;
  }
  return { folders: map, files };
}

export function usageOf(tree: Tree): StorageUsage {
  return { files: tree.files.length, bytes: tree.files.reduce((s, f) => s + (f.length || 0), 0), folders: tree.folders.size };
}

const parentOf = (tree: Tree, id: string) => tree.folders.get(id)?.parent ?? null;

/** Root = 0, a top-level folder = 1. */
export function depthOf(tree: Tree, id: string | null): number {
  let d = 0;
  for (let cur = id; cur && d <= LIMITS.files.maxFolderDepth + 1; cur = parentOf(tree, cur)) d++;
  return d;
}

/** Ids of `id` and all folders below it. */
export function subtreeIds(tree: Tree, id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [fid, f] of tree.folders) {
      const p = f.parent;
      if (p && out.has(p) && !out.has(fid)) {
        out.add(fid);
        grew = true;
      }
    }
  }
  return out;
}

/** Number of folder levels in the subtree of `id`, counting `id` itself (a leaf folder = 1). */
function subtreeHeight(tree: Tree, id: string): number {
  let max = 1;
  for (const fid of subtreeIds(tree, id)) {
    let h = 1;
    for (let cur: string | null = fid; cur && cur !== id; cur = parentOf(tree, cur)) h++;
    max = Math.max(max, h);
  }
  return max;
}

function requireFolder(tree: Tree, id: string | null): string | null {
  if (id !== null && !tree.folders.has(id)) throw new HttpError(404, "folder_not_found");
  return id;
}

const folderKeysIn = (tree: Tree, parent: string | null, except?: Set<string>) =>
  new Set([...tree.folders.values()].filter((f) => (f.parent ?? null) === parent && !except?.has(f._id.toString())).map((f) => f.nameKey));

const fileKeysIn = (tree: Tree, folder: string | null, except?: Set<string>) =>
  new Set(tree.files.filter((f) => (f.metadata?.folderId ?? null) === folder && !except?.has(f._id.toString())).map((f) => nameKey(f.metadata?.originalName ?? "")));

function checkQuota(usage: StorageUsage, addFiles: number, addBytes: number, addFolders = 0) {
  if (usage.files + addFiles > LIMITS.user.maxUploads) {
    throw new HttpError(403, "upload_limit", { limit: LIMITS.user.maxUploads, used: usage.files, adding: addFiles });
  }
  if (usage.bytes + addBytes > LIMITS.user.maxStorageBytes) {
    throw new HttpError(403, "storage_limit", { limit: LIMITS.user.maxStorageBytes, used: usage.bytes, adding: addBytes });
  }
  if (usage.folders + addFolders > LIMITS.files.maxFolders) {
    throw new HttpError(403, "folder_limit", { limit: LIMITS.files.maxFolders });
  }
}

function nameOrThrow(raw: unknown): string {
  const v = validateName(raw);
  if (!v.ok) throw new HttpError(400, "invalid_name", { reason: v.error });
  return v.name;
}

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

// ---------------------------------------------------------------- storing files

async function storeFile(owner: string, folderId: string | null, name: string, image: CheckedImage): Promise<FileDoc> {
  const { bucket } = await uploadsFiles();
  const meta: UploadMeta = { owner, contentType: image.type, width: image.width, height: image.height, originalName: name, folderId };
  const id = await new Promise<OID>((resolve, reject) => {
    const stream = bucket.openUploadStream(name, { metadata: meta });
    stream.once("finish", () => resolve(stream.id as OID));
    stream.once("error", reject);
    stream.end(Buffer.from(image.bytes));
  });
  return { _id: id, length: image.bytes.length, uploadDate: new Date(), metadata: meta };
}

const IMAGE_ERRORS: Record<ImageCheckError, { status: number; code: string; reason: SkippedEntry["reason"] }> = {
  badType: { status: 415, code: "unsupported_type", reason: "bad_type" },
  corrupt: { status: 422, code: "corrupt_image", reason: "corrupt" },
  tooLarge: { status: 413, code: "file_too_large", reason: "too_large" },
  dimensions: { status: 422, code: "image_dimensions", reason: "dimensions" },
  unsafeSvg: { status: 422, code: "unsafe_svg", reason: "unsafe_svg" },
};

/** Stores one validated image in `folderId`. */
export async function uploadImage(owner: string, rawName: string, bytes: Uint8Array, folderIdRaw: string | null): Promise<UploadResult> {
  const checked = checkImage(bytes, LIMITS.user.maxUploadBytes);
  if (!checked.ok) {
    const e = IMAGE_ERRORS[checked.error];
    throw new HttpError(e.status, e.code, e.code === "file_too_large" ? { maxBytes: LIMITS.user.maxUploadBytes } : undefined);
  }
  return withUserLock(owner, async () => {
    const tree = await loadTree(owner);
    const folderId = requireFolder(tree, folderIdRaw);
    checkQuota(usageOf(tree), 1, checked.image.bytes.length);
    const name = uniqueName(withTypeExtension(sanitizeName(rawName, "image"), checked.image.type), fileKeysIn(tree, folderId));
    const doc = await storeFile(owner, folderId, name, checked.image);
    return { uploads: [toUploadInfo(doc)], folders: [], skipped: [] };
  });
}

// ---------------------------------------------------------------- archives

/**
 * Normalises an archive entry path into safe segments.
 * Returns null for anything that tries to escape the target folder (absolute paths, drive letters,
 * UNC paths, ".." segments) - such entries are skipped, never "fixed".
 */
export function entrySegments(raw: string): string[] | null {
  const p = raw.replace(/\\/g, "/");
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p) || p.includes("\0")) return null;
  const segs = p.split("/").filter((s) => s !== "" && s !== ".");
  if (segs.some((s) => s === "..")) return null;
  return segs;
}

const displayPath = (raw: string) =>
  [...raw.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, "?")].slice(0, 200).join("");

/** Extracts the images of an archive into `folderId`, recreating its directory structure. */
export async function extractArchive(owner: string, bytes: Buffer, folderIdRaw: string | null): Promise<UploadResult> {
  if (bytes.length > LIMITS.files.maxArchiveBytes) throw new HttpError(413, "archive_too_large", { maxBytes: LIMITS.files.maxArchiveBytes });
  let entries;
  try {
    ({ entries } = readArchive(bytes, { maxEntries: LIMITS.files.maxArchiveEntries, maxUnpackedBytes: LIMITS.files.maxArchiveUnpackedBytes }));
  } catch (e) {
    if (e instanceof ArchiveError) {
      const status = e.code === "archive_too_large_unpacked" ? 413 : 422;
      throw new HttpError(status, e.code, e.code === "archive_too_many_entries" ? { max: LIMITS.files.maxArchiveEntries } : undefined);
    }
    throw e;
  }

  return withUserLock(owner, async () => {
    const tree = await loadTree(owner);
    const target = requireFolder(tree, folderIdRaw);
    const baseDepth = depthOf(tree, target);
    const maxDepth = LIMITS.files.maxFolderDepth;

    // "<parentId|root>/<nameKey>" -> folder id, for existing folders (merged into) and planned ones.
    const childIndex = new Map<string, string>();
    for (const [id, f] of tree.folders) childIndex.set(`${f.parent ?? "root"}/${f.nameKey}`, id);
    const newFolders: { _id: OID; name: string; parent: string | null }[] = [];
    const ensureFolder = (segs: string[]): string | null => {
      let parent = target;
      for (const seg of segs) {
        const key = `${parent ?? "root"}/${nameKey(seg)}`;
        let id = childIndex.get(key);
        if (!id) {
          const _id = new ObjectId();
          id = _id.toString();
          newFolders.push({ _id, name: seg, parent });
          childIndex.set(key, id);
        }
        parent = id;
      }
      return parent;
    };

    const skipped: SkippedEntry[] = [];
    const pending: { folderId: string | null; name: string; image: CheckedImage }[] = [];
    let unpacked = 0;

    for (const entry of entries) {
      const shown = displayPath(entry.path);
      const raw = entrySegments(entry.path);
      if (raw === null) {
        skipped.push({ path: shown, reason: "unsafe_path" });
        continue;
      }
      if (!raw.length || isSystemJunk(raw)) continue;
      if (entry.kind === "other") {
        skipped.push({ path: shown, reason: entry.problem === "link" ? "link" : "special" });
        continue;
      }
      const segs = raw.map((s) => sanitizeName(s, "_"));
      if (entry.kind === "dir") {
        if (baseDepth + segs.length > maxDepth) skipped.push({ path: shown, reason: "too_deep" });
        else ensureFolder(segs);
        continue;
      }
      const dirs = segs.slice(0, -1);
      const fileName = segs[segs.length - 1];
      if (fileKind(fileName) !== "image") {
        skipped.push({ path: shown, reason: "not_image" });
        continue;
      }
      if (baseDepth + dirs.length > maxDepth) {
        skipped.push({ path: shown, reason: "too_deep" });
        continue;
      }
      if (entry.problem) {
        skipped.push({ path: shown, reason: entry.problem === "encrypted" ? "encrypted" : "compression" });
        continue;
      }
      if (pending.length >= LIMITS.files.maxArchiveFiles) {
        skipped.push({ path: shown, reason: "too_many_files" });
        continue;
      }
      if (entry.size > LIMITS.user.maxUploadBytes) {
        skipped.push({ path: shown, reason: "too_large" });
        continue;
      }
      let data: Buffer;
      try {
        data = entry.read(LIMITS.user.maxUploadBytes);
      } catch (e) {
        if (e instanceof EntryError) {
          skipped.push({ path: shown, reason: e.code === "too_large" ? "too_large" : "corrupt" });
          continue;
        }
        throw e;
      }
      unpacked += data.length;
      if (unpacked > LIMITS.files.maxArchiveUnpackedBytes) {
        throw new HttpError(413, "archive_too_large_unpacked", { maxBytes: LIMITS.files.maxArchiveUnpackedBytes });
      }
      const checked = checkImage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), LIMITS.user.maxUploadBytes);
      if (!checked.ok) {
        skipped.push({ path: shown, reason: IMAGE_ERRORS[checked.error].reason });
        continue;
      }
      // The image is valid: only now are its folders planned.
      pending.push({ folderId: ensureFolder(dirs), name: withTypeExtension(fileName, checked.image.type), image: checked.image });
    }

    if (!pending.length && !newFolders.length) throw new HttpError(422, "archive_no_images", { skipped: skipped.slice(0, 200) });
    checkQuota(
      usageOf(tree),
      pending.length,
      pending.reduce((s, p) => s + p.image.bytes.length, 0),
      newFolders.length,
    );

    // Unique file names per folder (existing files + files added from this archive).
    const taken = new Map<string, Set<string>>();
    for (const p of pending) {
      const k = p.folderId ?? "root";
      if (!taken.has(k)) taken.set(k, fileKeysIn(tree, p.folderId));
      const set = taken.get(k)!;
      p.name = uniqueName(p.name, set);
      set.add(nameKey(p.name));
    }

    const createdFolders: FolderInfo[] = [];
    const storedFiles: FileDoc[] = [];
    try {
      if (newFolders.length) {
        // Parents are always planned before their children, so ordered insert keeps the tree valid.
        const docs = await Folder.insertMany(
          newFolders.map((f) => ({ _id: f._id, owner, name: f.name, nameKey: nameKey(f.name), parent: f.parent })),
          { ordered: true },
        );
        for (const d of docs) createdFolders.push(toFolderInfo(d));
      }
      for (const p of pending) storedFiles.push(await storeFile(owner, p.folderId, p.name, p.image));
    } catch (e) {
      // All or nothing: undo what was written.
      const { bucket } = await uploadsFiles();
      await Promise.all(storedFiles.map((f) => bucket.delete(f._id).catch(() => undefined)));
      await Folder.deleteMany({ owner, _id: { $in: newFolders.map((f) => f._id) } }).catch(() => undefined);
      if (isDuplicateKey(e)) throw new HttpError(409, "name_taken");
      throw e;
    }
    return { uploads: storedFiles.map(toUploadInfo), folders: createdFolders, skipped };
  });
}

// ---------------------------------------------------------------- folders

export async function createFolder(owner: string, rawName: unknown, parentRaw: string | null): Promise<FolderInfo> {
  const name = nameOrThrow(rawName);
  return withUserLock(owner, async () => {
    const tree = await loadTree(owner);
    const parent = requireFolder(tree, parentRaw);
    if (tree.folders.size >= LIMITS.files.maxFolders) throw new HttpError(403, "folder_limit", { limit: LIMITS.files.maxFolders });
    if (depthOf(tree, parent) + 1 > LIMITS.files.maxFolderDepth) throw new HttpError(400, "too_deep", { max: LIMITS.files.maxFolderDepth });
    if (folderKeysIn(tree, parent).has(nameKey(name))) throw new HttpError(409, "name_taken");
    try {
      const doc = await Folder.create({ owner, name, nameKey: nameKey(name), parent });
      return toFolderInfo(doc);
    } catch (e) {
      if (isDuplicateKey(e)) throw new HttpError(409, "name_taken");
      throw e;
    }
  });
}

export async function renameFolder(owner: string, id: string, rawName: unknown): Promise<FolderInfo> {
  const name = nameOrThrow(rawName);
  return withUserLock(owner, async () => {
    const tree = await loadTree(owner);
    const folder = tree.folders.get(id);
    if (!folder) throw new HttpError(404, "folder_not_found");
    if (folderKeysIn(tree, folder.parent ?? null, new Set([id])).has(nameKey(name))) throw new HttpError(409, "name_taken");
    try {
      await Folder.updateOne({ _id: folder._id, owner }, { $set: { name, nameKey: nameKey(name) } });
    } catch (e) {
      if (isDuplicateKey(e)) throw new HttpError(409, "name_taken");
      throw e;
    }
    return toFolderInfo({ ...folder, name });
  });
}

export async function renameFile(owner: string, id: string, rawName: unknown): Promise<UploadInfo> {
  let name = nameOrThrow(rawName);
  return withUserLock(owner, async () => {
    const tree = await loadTree(owner);
    const file = tree.files.find((f) => f._id.toString() === id);
    if (!file?.metadata) throw new HttpError(404, "not_found");
    // The extension always matches the stored type; typing "castle" for "castle.png" keeps ".png".
    const type = file.metadata.contentType as Parameters<typeof withTypeExtension>[1];
    const [, oldExt] = splitExt(file.metadata.originalName);
    const [, newExt] = splitExt(name);
    if (!newExt && oldExt) name = `${name}${oldExt}`;
    name = withTypeExtension(name, type);
    const v = validateName(name);
    if (!v.ok) throw new HttpError(400, "invalid_name", { reason: v.error });
    const folderId = file.metadata.folderId ?? null;
    if (fileKeysIn(tree, folderId, new Set([id])).has(nameKey(name))) throw new HttpError(409, "name_taken");
    const { files } = await uploadsFiles();
    await files.updateOne({ _id: file._id, "metadata.owner": owner }, { $set: { filename: name, "metadata.originalName": name } });
    return toUploadInfo({ ...file, metadata: { ...file.metadata, originalName: name } });
  });
}

// ---------------------------------------------------------------- move / delete

export async function moveItems(owner: string, fileIds: string[], folderIds: string[], targetRaw: string | null) {
  if (fileIds.length + folderIds.length > LIMITS.files.maxBatchItems) throw new HttpError(400, "too_many_items", { max: LIMITS.files.maxBatchItems });
  if (!fileIds.length && !folderIds.length) throw new HttpError(400, "nothing_selected");
  return withUserLock(owner, async () => {
    const tree = await loadTree(owner);
    const target = requireFolder(tree, targetRaw);
    const fileById = new Map(tree.files.map((f) => [f._id.toString(), f]));
    for (const id of fileIds) if (!fileById.has(id)) throw new HttpError(404, "not_found");
    for (const id of folderIds) if (!tree.folders.has(id)) throw new HttpError(404, "folder_not_found");

    // A folder can't go into itself or anything below it.
    const targetChain = new Set<string>();
    for (let cur = target; cur; cur = parentOf(tree, cur)) targetChain.add(cur);
    for (const id of folderIds) if (targetChain.has(id)) throw new HttpError(400, "move_into_self");

    // Items inside another selected folder move with it and are not moved on their own.
    const selected = new Set(folderIds);
    const insideSelected = (folder: string | null) => {
      for (let cur = folder; cur; cur = parentOf(tree, cur)) if (selected.has(cur)) return true;
      return false;
    };
    const topFolders = folderIds.filter((id) => !insideSelected(parentOf(tree, id)) && parentOf(tree, id) !== target);
    const movedFiles = fileIds.filter((id) => {
      const fid = fileById.get(id)!.metadata?.folderId ?? null;
      return !insideSelected(fid) && fid !== target;
    });

    const targetDepth = depthOf(tree, target);
    for (const id of topFolders) {
      if (targetDepth + subtreeHeight(tree, id) > LIMITS.files.maxFolderDepth) {
        throw new HttpError(400, "too_deep", { max: LIMITS.files.maxFolderDepth, folder: tree.folders.get(id)!.name });
      }
    }

    const renamed: { id: string; from: string; to: string }[] = [];
    const folderTaken = folderKeysIn(tree, target, new Set(topFolders));
    const folderUpdates = topFolders.map((id) => {
      const f = tree.folders.get(id)!;
      const name = uniqueName(f.name, folderTaken);
      folderTaken.add(nameKey(name));
      if (name !== f.name) renamed.push({ id, from: f.name, to: name });
      return { id, name };
    });
    const fileTaken = fileKeysIn(tree, target, new Set(movedFiles));
    const fileUpdates = movedFiles.map((id) => {
      const old = fileById.get(id)!.metadata?.originalName ?? "file";
      const name = uniqueName(old, fileTaken);
      fileTaken.add(nameKey(name));
      if (name !== old) renamed.push({ id, from: old, to: name });
      return { id, name };
    });

    for (const u of folderUpdates) {
      await Folder.updateOne(
        { _id: new ObjectId(u.id), owner },
        { $set: { parent: target, name: u.name, nameKey: nameKey(u.name) } },
      ).catch((e) => {
        if (isDuplicateKey(e)) throw new HttpError(409, "name_taken");
        throw e;
      });
    }
    const { files } = await uploadsFiles();
    for (const u of fileUpdates) {
      await files.updateOne(
        { _id: new ObjectId(u.id), "metadata.owner": owner },
        { $set: { filename: u.name, "metadata.originalName": u.name, "metadata.folderId": target } },
      );
    }
    return { moved: folderUpdates.length + fileUpdates.length, renamed };
  });
}

export async function deleteItems(owner: string, fileIds: string[], folderIds: string[]) {
  if (fileIds.length + folderIds.length > LIMITS.files.maxBatchItems) throw new HttpError(400, "too_many_items", { max: LIMITS.files.maxBatchItems });
  if (!fileIds.length && !folderIds.length) throw new HttpError(400, "nothing_selected");
  return withUserLock(owner, async () => {
    const tree = await loadTree(owner);
    for (const id of folderIds) if (!tree.folders.has(id)) throw new HttpError(404, "folder_not_found");
    const fileSet = new Set(tree.files.map((f) => f._id.toString()));
    for (const id of fileIds) if (!fileSet.has(id)) throw new HttpError(404, "not_found");

    const doomedFolders = new Set<string>();
    for (const id of folderIds) for (const s of subtreeIds(tree, id)) doomedFolders.add(s);
    const doomedFiles = new Set(fileIds);
    for (const f of tree.files) if (f.metadata?.folderId && doomedFolders.has(f.metadata.folderId)) doomedFiles.add(f._id.toString());

    const { bucket } = await uploadsFiles();
    // Files first: if this is interrupted, leftover folders are harmless, orphaned files are not.
    for (const id of doomedFiles) await bucket.delete(new ObjectId(id)).catch(() => undefined);
    if (doomedFolders.size) {
      await Folder.deleteMany({ owner, _id: { $in: [...doomedFolders].map((id) => new ObjectId(id)) } });
    }
    return { deletedFiles: doomedFiles.size, deletedFolders: doomedFolders.size };
  });
}
