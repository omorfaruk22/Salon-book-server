import { model, models, Schema, type Model } from "mongoose";

export interface ServiceRecord {
  name: string;
  slug: string;
  description: string;
  category: string;
  durationMinutes: number;
  price: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<ServiceRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, required: true, trim: true, lowercase: true, maxlength: 60, index: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 600 },
    price: { type: Number, required: true, min: 0.01, max: 1000000 },
    imageUrl: { type: String, trim: true, maxlength: 2048 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

serviceSchema.index({ isActive: 1, category: 1, price: 1 });
serviceSchema.index({ isActive: 1, name: 1, _id: 1 });
serviceSchema.index({ isActive: 1, price: 1, name: 1, _id: 1 });
serviceSchema.index({ name: "text", description: "text", category: "text" });

export const Service: Model<ServiceRecord> = (models.Service as Model<ServiceRecord> | undefined) ?? model<ServiceRecord>("Service", serviceSchema);
