import { model, models, Schema, type Model } from "mongoose";

export type UserRole = "customer" | "admin";
export type UserStatus = "active" | "blocked";
export interface UserRecord {
  authUserId: string;
  name: string;
  email: string;
  phone?: string;
  imageUrl?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserRecord>(
  {
    authUserId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    imageUrl: { type: String, trim: true, maxlength: 2048 },
    role: { type: String, enum: ["customer", "admin"], default: "customer", required: true, index: true },
    status: { type: String, enum: ["active", "blocked"], default: "active", required: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ role: 1, status: 1, createdAt: -1 });
export const User: Model<UserRecord> = (models.User as Model<UserRecord> | undefined) ?? model<UserRecord>("User", userSchema);
