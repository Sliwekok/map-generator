import "server-only";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function error(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function isObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id) && /^[a-f0-9]{24}$/i.test(id);
}

/** Thrown from route/service code to produce a JSON error response `{ error: code, ...extra }`. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, public extra?: Record<string, unknown>) {
    super(code);
  }
}

/** Wraps a route handler so unexpected errors (e.g. DB down) produce a clean JSON 500/503. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return error(e.status, e.code, e.extra);
      console.error("[api]", e);
      const name = (e as Error)?.name ?? "";
      if (name.includes("MongooseServerSelectionError") || name.includes("MongoNetworkError")) {
        return error(503, "Database unavailable");
      }
      return error(500, "Internal server error");
    }
  };
}

/** Very small in-memory fixed-window rate limiter (per process). */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= max;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/**
 * CSRF guard for state-changing requests: browsers always send Origin on cross-site POST/PATCH/DELETE,
 * so a present Origin must match the Host the request was sent to.
 */
export function assertSameOrigin(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "bad_origin");
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "bad_origin");
  }
  if (!host || originHost !== host) throw new HttpError(403, "bad_origin");
}

/** Parses a small JSON object body; rejects other content types, oversized bodies and non-objects. */
export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw new HttpError(415, "json_required");
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new HttpError(413, "body_too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "body_too_large");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "invalid_json");
  return data as Record<string, unknown>;
}

/** Validates a list of ObjectId strings (deduplicated). Missing = empty list. */
export function idList(value: unknown, max: number, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "invalid_ids", { field });
  if (value.length > max) throw new HttpError(400, "too_many_items", { field, max });
  const out = new Set<string>();
  for (const v of value) {
    if (typeof v !== "string" || !isObjectId(v)) throw new HttpError(400, "invalid_ids", { field });
    out.add(v.toLowerCase());
  }
  return [...out];
}

/** Folder id from a request: null / "" / "root" mean the root folder, otherwise a valid ObjectId. */
export function folderIdParam(value: unknown): string | null {
  if (value === undefined || value === null || value === "" || value === "root") return null;
  if (typeof value !== "string" || !isObjectId(value)) throw new HttpError(400, "invalid_folder");
  return value.toLowerCase();
}
