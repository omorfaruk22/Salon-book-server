import { model, models, Schema, type Model } from "mongoose";

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";
export interface AppointmentRecord {
  customerId: string;
  serviceId: Schema.Types.ObjectId;
  serviceSnapshot: { name: string; durationMinutes: number; price: number };
  startsAt: Date;
  customerNote?: string;
  status: AppointmentStatus;
  cancelledBy?: "customer" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<AppointmentRecord>(
  {
    customerId: { type: String, required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true, index: true },
    serviceSnapshot: {
      name: { type: String, required: true },
      durationMinutes: { type: Number, required: true, min: 5 },
      price: { type: Number, required: true, min: 0 },
    },
    startsAt: { type: Date, required: true, index: true },
    customerNote: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ["pending", "confirmed", "cancelled", "completed"], default: "pending", index: true },
    cancelledBy: { type: String, enum: ["customer", "admin"] },
  },
  { timestamps: true, versionKey: false },
);

appointmentSchema.index({ customerId: 1, startsAt: -1 });
appointmentSchema.index({ status: 1, startsAt: 1 });

export const Appointment: Model<AppointmentRecord> = (models.Appointment as Model<AppointmentRecord> | undefined) ?? model<AppointmentRecord>("Appointment", appointmentSchema);
