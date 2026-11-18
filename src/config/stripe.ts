import Stripe from "stripe";

let stripeClient: Stripe | null = null;
export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw Object.assign(new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment."), { status: 503 });
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}
