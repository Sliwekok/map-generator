// Storage abstraction: guest maps live in IndexedDB, logged-in users' maps in MongoDB (via the API).
import { nanoid } from "nanoid";
import type { MapContent, MapDoc, SessionUser } from "@/lib/types";
import { LIMITS } from "@/lib/limits";
import { api, ApiError } from "./api";
import { localDb } from "./localDb";

export const isLocalId = (id: string) => id.startsWith("l_");

export class LimitError extends Error {
  constructor(public limit: number, public kind: "maps" | "uploads") {
    super("limit");
  }
}

export function contentOf(doc: MapContent): MapContent {
  const { name, width, height, background, grid, layers, elements } = doc;
  return { name, width, height, background, grid, layers, elements };
}

export async function listLocalMaps(): Promise<MapDoc[]> {
  return localDb.listMaps();
}

export async function listCloudMaps(): Promise<MapDoc[]> {
  const r = await api<{ maps: MapDoc[] }>("/api/maps");
  return r.maps;
}

export async function createMap(user: SessionUser | null, content: MapContent): Promise<MapDoc> {
  if (user) {
    try {
      const r = await api<{ map: MapDoc }>("/api/maps", { method: "POST", json: { content } });
      return r.map;
    } catch (e) {
      if (e instanceof ApiError && e.code === "map_limit") throw new LimitError(LIMITS.user.maxMaps, "maps");
      throw e;
    }
  }
  const existing = await localDb.listMaps();
  if (existing.length >= LIMITS.anonymous.maxMaps) throw new LimitError(LIMITS.anonymous.maxMaps, "maps");
  const now = new Date().toISOString();
  const doc: MapDoc = { ...content, id: `l_${nanoid(12)}`, source: "local", revision: 1, createdAt: now, updatedAt: now };
  await localDb.putMap(doc);
  return doc;
}

export async function loadMap(id: string): Promise<MapDoc | null> {
  if (isLocalId(id)) return (await localDb.getMap(id)) ?? null;
  try {
    const r = await api<{ map: MapDoc }>(`/api/maps/${id}`);
    return r.map;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 401)) return null;
    throw e;
  }
}

export type SaveResult = { ok: true; revision: number } | { ok: false; conflict: true; revision: number };

export async function saveMap(id: string, baseRevision: number, content: MapContent, force = false): Promise<SaveResult> {
  if (isLocalId(id)) {
    const cur = await localDb.getMap(id);
    const now = new Date().toISOString();
    const revision = (cur?.revision ?? baseRevision) + 1;
    await localDb.putMap({
      ...(cur ?? { id, source: "local", createdAt: now }),
      ...content,
      id,
      source: "local",
      revision,
      updatedAt: now,
    } as MapDoc);
    return { ok: true, revision };
  }
  try {
    const r = await api<{ revision: number }>(`/api/maps/${id}`, {
      method: "PUT",
      json: { baseRevision, content, force },
    });
    return { ok: true, revision: r.revision };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      return { ok: false, conflict: true, revision: Number(e.data.revision ?? 0) };
    }
    throw e;
  }
}

export async function deleteMap(id: string): Promise<void> {
  if (isLocalId(id)) return localDb.deleteMap(id);
  await api(`/api/maps/${id}`, { method: "DELETE" });
}

export async function renameMap(doc: MapDoc, name: string): Promise<void> {
  await saveMap(doc.id, doc.revision, { ...contentOf(doc), name }, true);
}
