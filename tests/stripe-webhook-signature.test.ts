import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { verifyStripeWebhookEvent } from "../src/modules/transactions/stripe-webhook";

test("Stripe webhook requires a valid signature over the exact raw request body", () => {
  const stripe = new Stripe("sk_test_salonbook_webhook_signature_test");
  const secret = "whsec_salonbook_signature_test";
  const payload = JSON.stringify({
    id: "evt_test_salonbook_1",
    object: "event",
    api_version: "2025-02-24.acacia",
    created: Math.floor(Date.now() / 1000),
    data: { object: {} },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: "checkout.session.completed",
  });
  const rawBody = Buffer.from(payload, "utf8");
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(verifyStripeWebhookEvent(stripe, rawBody, signature, secret).id, "evt_test_salonbook_1");
  assert.throws(() => verifyStripeWebhookEvent(stripe, rawBody, "t=1,v1=invalid", secret));
  assert.throws(() => verifyStripeWebhookEvent(stripe, Buffer.from(`${payload} `), signature, secret));
});
