import Stripe from "stripe";
import { env } from "./env";

let stripeClient: Stripe | null = null;
export function getStripe() {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) throw Object.assign(new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment."), { status: 503 });
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}
