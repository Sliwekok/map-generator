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
}
