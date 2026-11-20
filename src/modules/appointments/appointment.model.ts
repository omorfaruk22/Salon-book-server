import { model, models, Schema, type Model } from "mongoose";
import { APPOINTMENT_TIME_SLOTS } from "./appointment.schedule";

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type AppointmentPaymentStatus = "unpaid" | "paid";
export interface AppointmentRecord {
  customerId: string;
  serviceId: Schema.Types.ObjectId;
  serviceSnapshot: { name: string; category?: string; description?: string; imageUrl?: string; durationMinutes: number; price: number };
  startsAt: Date;
  /** Salon-local calendar date and configured slot start; startsAt remains the UTC instant used by existing features. */
  appointmentDate?: string;
  timeSlot?: string;
  customerNote?: string;
  status: AppointmentStatus;
  paymentStatus: AppointmentPaymentStatus;
  /** Unique minute keys reserve overlapping service durations across concurrent requests. */
  reservedSlotKeys: number[];
  slotReserved: boolean;
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
      category: { type: String, trim: true, maxlength: 60 },
      description: { type: String, trim: true, maxlength: 2000 },
      imageUrl: { type: String, trim: true, maxlength: 2048 },
      durationMinutes: { type: Number, required: true, min: 5 },
      price: { type: Number, required: true, min: 0.01 },
    },
    startsAt: { type: Date, required: true, index: true },
    appointmentDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    timeSlot: { type: String, enum: APPOINTMENT_TIME_SLOTS.map((slot) => slot.start), match: /^\d{2}:\d{2}$/ },
    customerNote: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ["pending", "confirmed", "cancelled", "completed"], default: "pending", index: true },
    paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid", required: true },
    reservedSlotKeys: { type: [Number], default: [] },
    slotReserved: { type: Boolean, default: true, required: true },
    cancelledBy: { type: String, enum: ["customer", "admin"] },
  },
  { timestamps: true, versionKey: false },
);

appointmentSchema.index({ customerId: 1, startsAt: -1 });
appointmentSchema.index({ status: 1, startsAt: 1 });
const reservationIndex = { reservedSlotKeys: 1 } as const;
const reservationIndexOptions = {
  unique: true,
  partialFilterExpression: { slotReserved: true },
  name: "unique_active_appointment_minutes",
} as const;
appointmentSchema.index(reservationIndex, reservationIndexOptions);

export const Appointment: Model<AppointmentRecord> = (models.Appointment as Model<AppointmentRecord> | undefined) ?? model<AppointmentRecord>("Appointment", appointmentSchema);

/** Ensure double-booking protection exists before the HTTP server accepts requests, even when autoIndex is disabled in production. */
export async function ensureAppointmentReservationIndex() {
  await Appointment.collection.createIndex(reservationIndex, reservationIndexOptions);
}
