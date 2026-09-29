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

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export type MapDocument = InferSchemaType<typeof mapSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument>) ?? mongoose.model<UserDocument>("User", userSchema);

export const MapModel: Model<MapDocument> =
  (mongoose.models.Map as Model<MapDocument>) ?? mongoose.model<MapDocument>("Map", mapSchema);
