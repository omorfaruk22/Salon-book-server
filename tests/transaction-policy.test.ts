import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAppointmentPayable,
  assertPaymentIntentMatchesTransaction,
  assertSessionMatchesTransaction,
  hasProcessedEvent,
  isFailedCheckoutEvent,
  isSuccessfulCheckoutEvent,
  toStripeMinorUnits,
} from "../src/modules/transactions/transaction.policy";

const transaction = { _id: "507f1f77bcf86cd799439011", appointmentId: "507f1f77bcf86cd799439012", customerId: "auth-user-1", amount: 500, currency: "bdt" };

test("only the owning customer can pay confirmed, unpaid appointments", () => {
  assert.doesNotThrow(() => assertAppointmentPayable({ customerId: transaction.customerId, status: "confirmed", paymentStatus: "unpaid" }, transaction.customerId));
  for (const appointment of [
    { customerId: "other-user", status: "confirmed", paymentStatus: "unpaid" },
    { customerId: transaction.customerId, status: "pending", paymentStatus: "unpaid" },
    { customerId: transaction.customerId, status: "cancelled", paymentStatus: "unpaid" },
    { customerId: transaction.customerId, status: "confirmed", paymentStatus: "paid" },
  ]) assert.throws(() => assertAppointmentPayable(appointment, transaction.customerId), { status: 409 });
});

test("BDT Checkout amounts are converted to the correct minor units", () => {
  assert.equal(toStripeMinorUnits(500), 50000);
  assert.equal(toStripeMinorUnits(500.25), 50025);
  assert.throws(() => toStripeMinorUnits(0));
  assert.throws(() => toStripeMinorUnits(50, "usd"));
});

test("Checkout session and PaymentIntent must match stored metadata, amount, and currency", () => {
  const session = { id: "cs_test_123", metadata: { transactionId: transaction._id, appointmentId: transaction.appointmentId, customerId: transaction.customerId }, amount_total: 50000, currency: "bdt" };
  assert.doesNotThrow(() => assertSessionMatchesTransaction(session, transaction));
  assert.throws(() => assertSessionMatchesTransaction({ ...session, amount_total: 100 }, transaction));
  assert.throws(() => assertSessionMatchesTransaction({ ...session, metadata: { ...session.metadata, customerId: "wrong" } }, transaction));
  const paymentIntent = { id: "pi_test_1", metadata: session.metadata, amount: 50000, currency: "bdt", status: "succeeded" };
  assert.doesNotThrow(() => assertPaymentIntentMatchesTransaction(paymentIntent, transaction));
  assert.throws(() => assertPaymentIntentMatchesTransaction({ ...paymentIntent, status: "processing" }, transaction));
});

test("checkout event status and idempotency helpers identify only verified events", () => {
  assert.equal(isSuccessfulCheckoutEvent("checkout.session.completed", "paid"), true);
  assert.equal(isSuccessfulCheckoutEvent("checkout.session.completed", "unpaid"), false);
  assert.equal(isSuccessfulCheckoutEvent("charge.succeeded", "paid"), false);
  assert.equal(isFailedCheckoutEvent("checkout.session.expired"), true);
  assert.equal(isFailedCheckoutEvent("checkout.session.async_payment_failed"), true);
  assert.equal(hasProcessedEvent(["evt_1"], "evt_1"), true);
  assert.equal(hasProcessedEvent(["evt_1"], "evt_2"), false);
});
