export const CHECKOUT_CURRENCY = "bdt";

export type PayableAppointment = {
  customerId: string;
  status: string;
  paymentStatus?: string;
};

export type CheckoutTransactionReference = {
  _id: { toString(): string } | string;
  appointmentId: { toString(): string } | string;
  customerId: string;
  amount: number;
  currency: string;
};

export type CheckoutSessionReference = {
  id: string;
  metadata?: Record<string, string | undefined> | null;
  amount_total?: number | null;
  currency?: string | null;
};

export type PaymentIntentReference = {
  id: string;
  metadata?: Record<string, string | undefined> | null;
  amount: number;
  currency: string;
  status: string;
};

function policyError(message: string) {
  return Object.assign(new Error(message), { status: 409 });
}

export function assertAppointmentPayable(appointment: PayableAppointment, customerId: string) {
  if (appointment.customerId !== customerId) throw policyError("You cannot pay for another customer’s appointment.");
  if (appointment.status !== "confirmed") throw policyError("Only confirmed appointments can be paid.");
  if (appointment.paymentStatus !== "unpaid") throw policyError("This appointment is not eligible for another payment.");
}

export function toStripeMinorUnits(amount: number, currency = CHECKOUT_CURRENCY) {
  if (currency !== CHECKOUT_CURRENCY || !Number.isFinite(amount) || amount <= 0) {
    throw policyError("This appointment amount cannot be processed in the configured currency.");
  }
  const minorUnits = Math.round(amount * 100);
  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
    throw policyError("This appointment amount is outside Stripe’s supported range.");
  }
  return minorUnits;
}

export function assertSessionMatchesTransaction(session: CheckoutSessionReference, transaction: CheckoutTransactionReference) {
  if (session.metadata?.transactionId !== String(transaction._id)
    || session.metadata?.appointmentId !== String(transaction.appointmentId)
    || session.metadata?.customerId !== transaction.customerId) {
    throw new Error("Stripe checkout references do not match the stored transaction.");
  }
  if (session.amount_total !== toStripeMinorUnits(transaction.amount, transaction.currency)
    || session.currency?.toLowerCase() !== transaction.currency.toLowerCase()) {
    throw new Error("Stripe checkout amount or currency does not match the stored transaction.");
  }
}

export function assertPaymentIntentMatchesTransaction(paymentIntent: PaymentIntentReference, transaction: CheckoutTransactionReference) {
  if (paymentIntent.metadata?.transactionId !== String(transaction._id)
    || paymentIntent.metadata?.appointmentId !== String(transaction.appointmentId)
    || paymentIntent.metadata?.customerId !== transaction.customerId) {
    throw new Error("Stripe payment references do not match the stored transaction.");
  }
  if (paymentIntent.amount !== toStripeMinorUnits(transaction.amount, transaction.currency)
    || paymentIntent.currency?.toLowerCase() !== transaction.currency.toLowerCase()
    || paymentIntent.status !== "succeeded") {
    throw new Error("Stripe payment amount, currency, or status does not match the stored transaction.");
  }
}

export function isSuccessfulCheckoutEvent(eventType: string, paymentStatus: string | null | undefined) {
  return (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded")
    && paymentStatus === "paid";
}

export function isFailedCheckoutEvent(eventType: string) {
  return eventType === "checkout.session.async_payment_failed" || eventType === "checkout.session.expired";
}

export function hasProcessedEvent(eventIds: readonly string[], eventId: string) {
  return eventIds.includes(eventId);
}
