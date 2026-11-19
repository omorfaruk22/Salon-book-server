import Stripe from "stripe";
import { Types } from "mongoose";
import { getStripe } from "../../config/stripe";
import { Appointment } from "../appointments/appointment.model";
import { User } from "../users/user.model";
import { Transaction } from "./transaction.model";
import { Service } from "../services/service.model";
import { env } from "../../config/env";

function httpError(status: number, message: string) { return Object.assign(new Error(message), { status }); }

export async function createCheckout(customerId: string, appointmentId: string) {
  const appointment = await Appointment.findOne({ _id: appointmentId, customerId }).lean();
  if (!appointment) throw httpError(404, "Appointment not found");
  if (appointment.status !== "confirmed") throw httpError(409, "Only confirmed appointments can be paid");
  const alreadyPaid = await Transaction.exists({ appointmentId: appointment._id, status: "paid" });
  if (alreadyPaid) throw httpError(409, "This appointment has already been paid");

  const stripe = getStripe();
  let attempt = await Transaction.findOne({ appointmentId: appointment._id, status: "pending" });
  if (attempt?.providerSessionId) {
    const existingAttempt = attempt;
    try {
      const existingSession = await stripe.checkout.sessions.retrieve(existingAttempt.providerSessionId!);
      if (existingSession.status === "open" && existingSession.url) return { url: existingSession.url };
      if (existingSession.status === "complete") {
        if (existingSession.payment_status === "paid") {
          const metadata = existingSession.metadata;
          if (metadata?.transactionId !== String(existingAttempt._id) || metadata?.appointmentId !== String(existingAttempt.appointmentId) || metadata?.customerId !== existingAttempt.customerId) {
            throw httpError(409, "Stripe checkout details do not match this transaction. Contact the salon before retrying payment.");
          }
          if (existingSession.amount_total !== Math.round(existingAttempt.amount * 100) || existingSession.currency !== existingAttempt.currency) {
            throw httpError(409, "Stripe checkout amount does not match this transaction. Contact the salon before retrying payment.");
          }
          if (existingAttempt.status !== "refunded") {
            existingAttempt.status = "paid";
            existingAttempt.paidAt ??= new Date();
            const paymentIntentId = typeof existingSession.payment_intent === "string" ? existingSession.payment_intent : existingSession.payment_intent?.id;
            if (paymentIntentId) existingAttempt.providerPaymentIntentId = paymentIntentId;
            await existingAttempt.save();
          }
          return { paid: true };
        }
        throw httpError(409, "Payment is still processing. Refresh transaction history shortly.");
      }
      existingAttempt.status = "failed";
      await existingAttempt.save();
      attempt = null;
    } catch (error) {
      if (error instanceof Error && "status" in error) throw error;
      existingAttempt.status = "failed";
      await existingAttempt.save();
      attempt = null;
    }
  }

  if (!attempt) {
    attempt = await Transaction.create({
      appointmentId: appointment._id,
      customerId,
      serviceName: appointment.serviceSnapshot.name,
      amount: appointment.serviceSnapshot.price,
      currency: "bdt",
      provider: "stripe",
      status: "pending",
      stripeEventIds: [],
    });
  }

  const customer = await User.findOne({ authUserId: customerId }).select("email").lean();
  const origin = env.CLIENT_ORIGIN;
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: customer?.email,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "bdt",
            unit_amount: Math.round(appointment.serviceSnapshot.price * 100),
            product_data: {
              name: appointment.serviceSnapshot.name,
              description: `Salon appointment · ${appointment.serviceSnapshot.durationMinutes} minutes`,
            },
          },
        }],
        metadata: { transactionId: String(attempt._id), appointmentId: String(appointment._id), customerId },
        success_url: `${origin}/transactions?checkout=success`,
        cancel_url: `${origin}/appointments?checkout=cancelled`,
      },
      { idempotencyKey: `salonbook-checkout-${attempt._id}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    attempt.providerSessionId = session.id;
    await attempt.save();
    return { url: session.url };
  } catch (error) {
    attempt.status = "failed";
    await attempt.save();
    throw error;
  }
}

export async function listTransactions(customerId: string, isAdmin: boolean, page: number, limit: number) {
  const filter = isAdmin ? {} : { customerId };
  const [transactions, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Transaction.countDocuments(filter),
  ]);
  return { transactions, total };
}

export async function getTransaction(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return Transaction.findById(id).lean();
}

export async function processStripeEvent(event: Stripe.Event) {
  if (event.type.startsWith("checkout.session.")) {
    const session = event.data.object as Stripe.Checkout.Session;
    const transaction = await Transaction.findOne({ providerSessionId: session.id });
    if (!transaction || transaction.stripeEventIds.includes(event.id)) return;
    if (session.metadata?.transactionId !== String(transaction._id) || session.metadata?.appointmentId !== String(transaction.appointmentId) || session.metadata?.customerId !== transaction.customerId) {
      throw new Error("Stripe session metadata does not match the transaction");
    }
    if (session.amount_total !== Math.round(transaction.amount * 100) || session.currency !== transaction.currency) {
      throw new Error("Stripe session amount or currency does not match the transaction");
    }
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && session.payment_status === "paid") {
      if (transaction.status !== "refunded") {
        transaction.status = "paid";
        transaction.paidAt ??= new Date();
        if (paymentIntentId) transaction.providerPaymentIntentId = paymentIntentId;
      }
    } else if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
      if (transaction.status === "pending") transaction.status = "failed";
    }
    if (!transaction.stripeEventIds.includes(event.id)) transaction.stripeEventIds.push(event.id);
    await transaction.save();
    return;
  }
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (paymentIntentId) {
      await Transaction.updateOne({ providerPaymentIntentId: paymentIntentId }, { $set: { status: "refunded" }, $addToSet: { stripeEventIds: event.id } });
    }
  }
}

export async function dashboardSummary(customerId: string, isAdmin: boolean) {
  const appointmentFilter = isAdmin ? {} : { customerId };
  const transactionFilter = isAdmin ? {} : { customerId };
  const [appointments, transactions, totalCustomers, totalServices, activeServices] = await Promise.all([
    Appointment.aggregate([{ $match: appointmentFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Transaction.aggregate([{ $match: transactionFilter }, { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$amount" } } }]),
    isAdmin ? User.countDocuments({ role: "customer" }) : Promise.resolve(0),
    isAdmin ? Service.countDocuments() : Promise.resolve(0),
    isAdmin ? Service.countDocuments({ isActive: true }) : Promise.resolve(0),
  ]);
  return {
    appointments: Object.fromEntries(appointments.map((row) => [row._id, row.count])),
    transactions: Object.fromEntries(transactions.map((row) => [row._id, { count: row.count, revenue: row.revenue }])),
    ...(isAdmin ? { customers: totalCustomers, services: { total: totalServices, active: activeServices } } : {}),
  };
}
