import "server-only";
import mongoose, { type ConnectOptions } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/map-generator";

interface ParsedUri {
  hasCredentials: boolean;
  pathDb: string;
  hasAuthSource: boolean;
}

function parseUri(uri: string): ParsedUri {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/([^/?#]*)(\/[^?#]*)?(\?[^#]*)?/i);
  if (!m) return { hasCredentials: false, pathDb: "", hasAuthSource: false };
  const [, authority, path, query] = m;
  return {
    hasCredentials: authority.includes("@"),
    pathDb: decodeURIComponent((path ?? "").replace(/^\//, "")),
    hasAuthSource: !!query && /[?&]authSource=/i.test(query),
  };
}

const parsed = parseUri(MONGODB_URI);

/**
 * Database that stores the app data:
 *   1. MONGODB_DB env variable  2. database in the URI path  3. "map-generator"
 * Always passed explicitly as `dbName` - otherwise Mongoose silently falls back to "test".
 */
export const MONGODB_DB = process.env.MONGODB_DB?.trim() || parsed.pathDb || "map-generator";

/**
 * Database that holds the MongoDB user (credentials). Kept separate from the data database,
 * because the driver would otherwise authenticate against `dbName` / the URI path and fail
 * for users created in `admin` (the usual setup):
 *   1. `?authSource=` in the URI (left to the driver)  2. MONGODB_AUTH_SOURCE env  3. "admin"
 */
export function resolveAuthSource(p: ParsedUri = parsed, envAuthSource = process.env.MONGODB_AUTH_SOURCE): string | undefined {
  if (!p.hasCredentials || p.hasAuthSource) return undefined;
  return envAuthSource?.trim() || "admin";
}

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; dbName: string | null };

// Cache the connection across hot reloads in development and across invocations in production.
const globalForMongo = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = globalForMongo.__mongoose ?? { conn: null, promise: null, dbName: null };
globalForMongo.__mongoose = cache;

export async function connectDb(): Promise<typeof mongoose> {
  // A connection cached from before the DB name changed (dev hot reload) is dropped.
  if (cache.dbName && cache.dbName !== MONGODB_DB) {
    await mongoose.disconnect().catch(() => undefined);
    cache.conn = null;
    cache.promise = null;
  }
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.dbName = MONGODB_DB;
    const options: ConnectOptions = { dbName: MONGODB_DB, bufferCommands: false, serverSelectionTimeoutMS: 5000 };
    const authSource = resolveAuthSource();
    if (authSource) options.authSource = authSource;
    cache.promise = mongoose
      .connect(MONGODB_URI, options)
      .then((m) => {
        if (process.env.NODE_ENV !== "production") {
          console.info(`[db] connected to database "${m.connection.name}"${authSource ? ` (auth: ${authSource})` : ""}`);
        }
        return m;
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
