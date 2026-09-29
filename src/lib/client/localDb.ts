// Guest storage in the browser (IndexedDB via idb-keyval).
// IndexedDB is used instead of localStorage because maps and uploaded images can be large.
import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import type { MapDoc } from "@/lib/types";

let mapsStore: UseStore | null = null;
let uploadsStore: UseStore | null = null;

function maps() {
  return (mapsStore ??= createStore("mapforge-maps", "maps"));
}
function uploads() {
  return (uploadsStore ??= createStore("mapforge-uploads", "uploads"));
}

export interface LocalUpload {
  id: string;
  name: string;
  contentType: string;
  width: number;
  height: number;
  size: number;
  blob: Blob;
  createdAt: string;
}

export const localDb = {
  async listMaps(): Promise<MapDoc[]> {
    const all = await entries<string, MapDoc>(maps());
    return all.map(([, v]) => v).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  getMap: (id: string) => get<MapDoc>(id, maps()),
  putMap: (doc: MapDoc) => set(doc.id, doc, maps()),
  deleteMap: (id: string) => del(id, maps()),

  async listUploads(): Promise<LocalUpload[]> {
    const all = await entries<string, LocalUpload>(uploads());
    return all.map(([, v]) => v).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getUpload: (id: string) => get<LocalUpload>(id, uploads()),
  putUpload: (u: LocalUpload) => set(u.id, u, uploads()),
  deleteUpload: (id: string) => del(id, uploads()),
};
