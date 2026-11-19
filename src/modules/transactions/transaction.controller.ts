import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { getStripe } from "../../config/stripe";
import { env } from "../../config/env";
import { checkoutSchema } from "./transaction.validation";
import { createCheckout, getTransaction, listTransactions, processStripeEvent } from "./transaction.service";

function statusCode(error: unknown) { return typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 500; }

export async function checkout(req: Request, res: Response, next: NextFunction) {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: "A valid appointmentId is required" } });
  try {
    const user = (req as AuthenticatedRequest).authUser!;
    const result = await createCheckout(user.id, parsed.data.appointmentId);
    return res.json({ data: result, error: null });
  } catch (error) {
    const status = statusCode(error);
    if (status < 500) return res.status(status).json({ data: null, error: { message: (error as Error).message } });
    if (status === 503) return res.status(503).json({ data: null, error: { message: (error as Error).message } });
    return next(error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as AuthenticatedRequest).authUser!;
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));
    const result = await listTransactions(user.id, user.role === "admin", page, limit);
    return res.json({ data: result.transactions, error: null, meta: { page, limit, total: result.total } });
  } catch (error) { next(error); }
}

export async function details(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) return res.status(400).json({ data: null, error: { message: "Invalid transaction id" } });
  try {
    const transaction = await getTransaction(id);
    if (!transaction) return res.status(404).json({ data: null, error: { message: "Transaction not found" } });
    const user = (req as AuthenticatedRequest).authUser!;
    if (user.role !== "admin" && transaction.customerId !== user.id) return res.status(403).json({ data: null, error: { message: "You cannot view this transaction" } });
    return res.json({ data: transaction, error: null });
  } catch (error) { next(error); }
}

export async function webhook(req: Request, res: Response) {
  const signature = req.header("stripe-signature");
  if (!signature || !Buffer.isBuffer(req.body)) return res.status(400).send("Missing or invalid Stripe webhook signature");
  let event: import("stripe").Stripe.Event;
  try {
    const stripe = getStripe();
    const secret = env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(503).send("Stripe webhook is not configured");
    event = stripe.webhooks.constructEvent(req.body, signature, secret);
  } catch (error) {
    if (statusCode(error) === 503) return res.status(503).send((error as Error).message);
    return res.status(400).send("Invalid Stripe webhook signature");
  }
  try { await processStripeEvent(event); return res.json({ received: true }); }
  catch { console.error("[webhook:error] Stripe event processing failed"); return res.status(500).send("Webhook processing failed"); }
}
