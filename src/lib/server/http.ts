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

/** Wraps a route handler so unexpected errors (e.g. DB down) produce a clean JSON 500/503. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
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
