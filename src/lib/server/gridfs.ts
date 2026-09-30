import "server-only";
import mongoose from "mongoose";
import { connectDb } from "./db";

export async function uploadsBucket() {
  await connectDb();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });
}

export interface UploadMeta {
  owner: string;
  contentType: string;
  width: number;
  height: number;
  originalName: string;
  /** Folder id (string) or null for the root. Missing on files uploaded before folders existed. */
  folderId?: string | null;
}

/** Raw GridFS files collection, used for metadata updates (rename / move). */
export async function uploadsFiles() {
  const bucket = await uploadsBucket();
  const db = mongoose.connection.db!;
  return { bucket, files: db.collection("uploads.files") };
}
