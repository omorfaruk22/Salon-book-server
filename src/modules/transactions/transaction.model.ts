import { model, models, Schema, type Model } from "mongoose";

export type TransactionStatus = "pending" | "paid" | "failed" | "refunded";
export interface TransactionRecord {
  appointmentId: Schema.Types.ObjectId;
  customerId: string;
  serviceName: string;
  amount: number;
  currency: string;
  provider: "stripe";
  providerSessionId?: string;
  providerPaymentIntentId?: string;
  status: TransactionStatus;
  stripeEventIds: string[];
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<TransactionRecord>(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true },
    customerId: { type: String, required: true, index: true },
    serviceName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true, default: "bdt" },
    provider: { type: String, enum: ["stripe"], required: true, default: "stripe" },
    providerSessionId: { type: String, unique: true, sparse: true },
    providerPaymentIntentId: { type: String, sparse: true },
    status: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending", index: true },
    stripeEventIds: { type: [String], default: [] },
    paidAt: Date,
  },
  { timestamps: true, versionKey: false },
);

transactionSchema.index({ customerId: 1, createdAt: -1 });
transactionSchema.index({ appointmentId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
transactionSchema.index({ status: 1, createdAt: -1 });

export const Transaction: Model<TransactionRecord> = (models.Transaction as Model<TransactionRecord> | undefined) ?? model<TransactionRecord>("Transaction", transactionSchema);
