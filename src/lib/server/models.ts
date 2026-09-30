import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

const mapSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, maxlength: 80 },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    background: { type: Schema.Types.Mixed, required: true },
    grid: { type: Schema.Types.Mixed, required: true },
    layers: { type: Schema.Types.Mixed, required: true },
    // Elements are validated/sanitised in the API layer (see lib/mapContent.ts).
    elements: { type: [Schema.Types.Mixed], default: [] },
    // Incremented on every save; used for optimistic concurrency (two tabs editing one map).
    revision: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false },
);

// Virtual directories for uploaded files. Files live in GridFS ("uploads" bucket) and point to
// their folder through metadata.folderId (null / missing = root). Owner and parent are stored as
// hex id strings - the same form GridFS file metadata uses (metadata.owner / metadata.folderId).
const folderSchema = new Schema(
  {
    owner: { type: String, required: true, index: true, match: /^[a-f0-9]{24}$/ },
    name: { type: String, required: true, maxlength: 100 },
    // Lower-cased name: sibling folder names must be unique case-insensitively.
    nameKey: { type: String, required: true, maxlength: 100 },
    parent: { type: String, default: null, match: /^[a-f0-9]{24}$/ },
  },
  { timestamps: true },
);
folderSchema.index({ owner: 1, parent: 1, nameKey: 1 }, { unique: true });

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export type MapDocument = InferSchemaType<typeof mapSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type FolderDocument = InferSchemaType<typeof folderSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument>) ?? mongoose.model<UserDocument>("User", userSchema);

export const MapModel: Model<MapDocument> =
  (mongoose.models.Map as Model<MapDocument>) ?? mongoose.model<MapDocument>("Map", mapSchema);

export const Folder: Model<FolderDocument> =
  (mongoose.models.Folder as Model<FolderDocument>) ?? mongoose.model<FolderDocument>("Folder", folderSchema);
