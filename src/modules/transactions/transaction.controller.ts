import type { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { getStripe } from "../../config/stripe";
import { env } from "../../config/env";
import { checkoutSchema, transactionListQuerySchema } from "./transaction.validation";
import { createCheckout, getMyPaymentVerification, getMyTransaction, listMyTransactions, processStripeEvent } from "./transaction.service";
import { verifyStripeWebhookEvent } from "./stripe-webhook";

function statusCode(error: unknown) { return typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 500; }

export async function checkout(req: Request, res: Response, next: NextFunction) {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: "A valid appointmentId is required" } });
  try {
    const user = (req as AuthenticatedRequest).authUser!;
    const data = await createCheckout(user.id, parsed.data.appointmentId);
    return res.json({ data, error: null });
  } catch (error) {
    const status = statusCode(error);
    if (status < 500) return res.status(status).json({ data: null, error: { message: (error as Error).message } });
    return next(error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = transactionListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: "Invalid pagination parameters" } });
  try {
    const user = (req as AuthenticatedRequest).authUser!;
    const result = await listMyTransactions(user.id, parsed.data.page, parsed.data.limit);
    const { transactions, ...meta } = result;
    return res.json({ data: transactions, error: null, meta });
  } catch (error) { next(error); }
}

export async function details(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ data: null, error: { message: "Invalid transaction id" } });
  try {
    const user = (req as AuthenticatedRequest).authUser!;
    const transaction = await getMyTransaction(user.id, id);
    if (!transaction) return res.status(404).json({ data: null, error: { message: "Transaction not found" } });
    return res.json({ data: transaction, error: null });
  } catch (error) { next(error); }
}

export async function verifyCheckout(req: Request, res: Response, next: NextFunction) {
  const sessionId = String(req.params.sessionId ?? "");
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return res.status(400).json({ data: null, error: { message: "Invalid checkout session" } });
  try {
    const user = (req as AuthenticatedRequest).authUser!;
    const result = await getMyPaymentVerification(user.id, sessionId);
    if (!result) return res.status(404).json({ data: null, error: { message: "Checkout session not found" } });
    return res.json({ data: result, error: null });
  } catch (error) {
    const status = statusCode(error);
    if (status < 500) return res.status(status).json({ data: null, error: { message: (error as Error).message } });
    return next(error);
  }
}

export async function webhook(req: Request, res: Response) {
  const signature = req.header("stripe-signature");
  if (!signature || !Buffer.isBuffer(req.body)) return res.status(400).send("Missing or invalid Stripe webhook signature");
  let event: import("stripe").Stripe.Event;
  try {
    const stripe = getStripe();
    const secret = env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(503).send("Stripe webhook is not configured");
    event = verifyStripeWebhookEvent(stripe, req.body, signature, secret);
  } catch (error) {
    if (statusCode(error) === 503) return res.status(503).send((error as Error).message);
    return res.status(400).send("Invalid Stripe webhook signature");
  }
  try { await processStripeEvent(event); return res.json({ received: true }); }
  catch (error) {
    const errorName = error instanceof Error ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80) : "UnknownError";
    console.error("[webhook:error] Stripe event processing failed", errorName || "Error");
    return res.status(500).send("Webhook processing failed");
  }
}
