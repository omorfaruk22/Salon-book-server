import { model, models, Schema, type Model } from "mongoose";

export type TransactionStatus = "pending" | "paid" | "failed" | "refunded";
export interface TransactionRecord {
  appointmentId: Schema.Types.ObjectId;
  /** Set only by the verified webhook; sparse unique key protects one success per appointment. */
  successfulAppointmentId?: Schema.Types.ObjectId;
  customerId: string;
  serviceId?: Schema.Types.ObjectId;
  serviceName: string;
  amount: number;
  currency: string;
  provider: "stripe";
  providerSessionId?: string;
  providerPaymentIntentId?: string;
  paymentMethod?: string;
  status: TransactionStatus;
  /** Processed Stripe event IDs and server-side reconciliation markers for paid sessions. */
  stripeEventIds: string[];
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<TransactionRecord>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true },
    successfulAppointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    customerId: { type: String, required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service" },
    serviceName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, required: true, lowercase: true, default: "bdt" },
    provider: { type: String, enum: ["stripe"], required: true, default: "stripe" },
    providerSessionId: { type: String },
    providerPaymentIntentId: { type: String },
    paymentMethod: { type: String, trim: true, maxlength: 40 },
    status: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending", index: true },
    stripeEventIds: { type: [String], default: [] },
    paidAt: Date,
  },
  { timestamps: true, versionKey: false },
);

transactionSchema.index({ customerId: 1, createdAt: -1 });
transactionSchema.index({ providerSessionId: 1 }, { unique: true, sparse: true });
// Preserve the pre-existing sparse non-unique index; Stripe PaymentIntent IDs are unique by definition.
transactionSchema.index({ providerPaymentIntentId: 1 }, { sparse: true });
transactionSchema.index({ appointmentId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
transactionSchema.index({ successfulAppointmentId: 1 }, { unique: true, sparse: true, name: "one_successful_payment_per_appointment" });
transactionSchema.index({ status: 1, createdAt: -1 });

export const Transaction: Model<TransactionRecord> = (models.Transaction as Model<TransactionRecord> | undefined) ?? model<TransactionRecord>("Transaction", transactionSchema);

/** Ensure payment idempotency indexes exist before the server accepts checkout or webhook traffic. */
export async function ensureTransactionIndexes() {
  await Promise.all([
    Transaction.collection.createIndex({ providerSessionId: 1 }, { unique: true, sparse: true }),
    Transaction.collection.createIndex({ providerPaymentIntentId: 1 }, { sparse: true }),
    Transaction.collection.createIndex({ appointmentId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } }),
    Transaction.collection.createIndex({ successfulAppointmentId: 1 }, { unique: true, sparse: true, name: "one_successful_payment_per_appointment" }),
  ]);
}
