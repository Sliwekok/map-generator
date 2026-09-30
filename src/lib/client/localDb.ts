// Guest storage in the browser (IndexedDB via idb-keyval).
// IndexedDB is used instead of localStorage because maps can be large. (Guests can't upload files.)
import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import type { MapDoc } from "@/lib/types";

let mapsStore: UseStore | null = null;

function maps() {
  return (mapsStore ??= createStore("mapforge-maps", "maps"));
}

export const localDb = {
  async listMaps(): Promise<MapDoc[]> {
    const all = await entries<string, MapDoc>(maps());
    return all.map(([, v]) => v).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  getMap: (id: string) => get<MapDoc>(id, maps()),
  putMap: (doc: MapDoc) => set(doc.id, doc, maps()),
  deleteMap: (id: string) => del(id, maps()),
};
