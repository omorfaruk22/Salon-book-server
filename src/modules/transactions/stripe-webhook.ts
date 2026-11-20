import type Stripe from "stripe";

/** Stripe signatures must be checked against the untouched request bytes. */
export function verifyStripeWebhookEvent(stripe: Stripe, rawBody: Buffer, signature: string, secret: string): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
