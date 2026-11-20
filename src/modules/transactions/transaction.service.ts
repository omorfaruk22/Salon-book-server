import Stripe from "stripe";
import mongoose, { Types, type PipelineStage } from "mongoose";
import { getStripe } from "../../config/stripe";
import { env } from "../../config/env";
import { Appointment } from "../appointments/appointment.model";
import { User } from "../users/user.model";
import { Transaction, type TransactionRecord, type TransactionStatus } from "./transaction.model";
import type { AdminTransactionsQuery } from "./transaction.validation";
import {
  assertAppointmentPayable,
  assertPaymentIntentMatchesTransaction,
  assertSessionMatchesTransaction,
  CHECKOUT_CURRENCY,
  hasProcessedEvent,
  isFailedCheckoutEvent,
  isSuccessfulCheckoutEvent,
  toStripeMinorUnits,
} from "./transaction.policy";

type TransactionDocument = TransactionRecord & { _id: Types.ObjectId; appointmentId: Types.ObjectId; serviceId?: Types.ObjectId; successfulAppointmentId?: Types.ObjectId };

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && Number((error as { code: unknown }).code) === 11000;
}

function safeTransaction(transaction: TransactionDocument) {
  return {
    _id: String(transaction._id),
    appointmentId: String(transaction.appointmentId),
    ...(transaction.serviceId ? { serviceId: String(transaction.serviceId) } : {}),
    serviceName: transaction.serviceName,
    amount: transaction.amount,
    currency: transaction.currency,
    provider: transaction.provider,
    status: transaction.status,
    ...(transaction.paymentMethod ? { paymentMethod: transaction.paymentMethod } : {}),
    ...(transaction.paidAt ? { paidAt: transaction.paidAt } : {}),
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

function escapedRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dateRange(query: AdminTransactionsQuery) {
  const filter: Record<string, Date> = {};
  // Admin date filters use the salon's configured Bangladesh calendar day.
  if (query.dateFrom) filter.$gte = new Date(`${query.dateFrom}T00:00:00+06:00`);
  if (query.dateTo) filter.$lt = new Date(new Date(`${query.dateTo}T00:00:00+06:00`).getTime() + 24 * 60 * 60 * 1000);
  return Object.keys(filter).length ? filter : undefined;
}

async function getOrCreatePendingTransaction(appointment: TransactionDocument | Record<string, unknown>, customerId: string) {
  const appointmentData = appointment as TransactionDocument & {
    _id: Types.ObjectId;
    serviceId: Types.ObjectId;
    serviceSnapshot: { name: string; price: number };
  };
  let pending = await Transaction.findOne({ appointmentId: appointmentData._id, status: "pending" }).exec();
  if (pending) return pending;

  try {
    return await Transaction.create({
      appointmentId: appointmentData._id,
      customerId,
      serviceId: appointmentData.serviceId,
      serviceName: appointmentData.serviceSnapshot.name,
      amount: appointmentData.serviceSnapshot.price,
      currency: CHECKOUT_CURRENCY,
      provider: "stripe",
      status: "pending",
      stripeEventIds: [],
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    pending = await Transaction.findOne({ appointmentId: appointmentData._id, status: "pending" }).exec();
    if (pending) return pending;
    throw httpError(409, "A payment attempt is already being prepared. Please try again shortly.");
  }
}

export async function createCheckout(customerId: string, appointmentId: string) {
  const appointment = await Appointment.findOne({ _id: appointmentId, customerId }).lean().exec();
  if (!appointment) throw httpError(404, "Appointment not found");
  assertAppointmentPayable(appointment, customerId);

  const alreadyPaid = await Transaction.exists({ appointmentId: appointment._id, status: { $in: ["paid", "refunded"] } }).exec();
  if (alreadyPaid) throw httpError(409, "This appointment already has a verified payment.");
  const amountInMinorUnits = toStripeMinorUnits(appointment.serviceSnapshot.price, CHECKOUT_CURRENCY);
  const stripe = getStripe();
  let attempt = await getOrCreatePendingTransaction(appointment as unknown as TransactionDocument, customerId);

  if (attempt.serviceName !== appointment.serviceSnapshot.name
    || attempt.amount !== appointment.serviceSnapshot.price
    || attempt.currency !== CHECKOUT_CURRENCY) {
    throw httpError(409, "The stored payment amount does not match this appointment. Contact the salon before retrying.");
  }

  if (attempt.providerSessionId) {
    let existingSession: Stripe.Checkout.Session;
    try { existingSession = await stripe.checkout.sessions.retrieve(attempt.providerSessionId); }
    catch { throw httpError(502, "Could not check the existing Stripe Checkout. Please try again shortly."); }
    assertSessionMatchesTransaction(existingSession, attempt as unknown as TransactionDocument);
    if (existingSession.status === "open" && existingSession.url) return { url: existingSession.url };
    if (existingSession.status === "complete") {
      if (existingSession.payment_status === "paid") {
        await markCheckoutPaid(attempt._id, existingSession, "reconcile:" + existingSession.id);
      }
      return { processing: true, sessionId: existingSession.id };
    }
    await Transaction.updateOne({ _id: attempt._id, status: "pending" }, { $set: { status: "failed" } }).exec();
    attempt = await getOrCreatePendingTransaction(appointment as unknown as TransactionDocument, customerId);
  }

  // Recheck eligibility after finding or reserving the one pending attempt.
  const latestAppointment = await Appointment.findOne({ _id: appointment._id, customerId }).lean().exec();
  if (!latestAppointment) throw httpError(404, "Appointment not found");
  try { assertAppointmentPayable(latestAppointment, customerId); }
  catch (error) {
    await Transaction.updateOne({ _id: attempt._id, status: "pending", providerSessionId: { $exists: false } }, { $set: { status: "failed" } }).exec();
    throw error;
  }
  if (await Transaction.exists({ appointmentId: appointment._id, status: { $in: ["paid", "refunded"] } }).exec()) {
    throw httpError(409, "This appointment already has a verified payment.");
  }

  const customer = await User.findOne({ authUserId: customerId }).select("email").lean().exec();
  try {
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        ...(customer?.email ? { customer_email: customer.email } : {}),
        line_items: [{
          quantity: 1,
          price_data: {
            currency: CHECKOUT_CURRENCY,
            unit_amount: amountInMinorUnits,
            product_data: {
              name: latestAppointment.serviceSnapshot.name,
              description: `Salon appointment · ${latestAppointment.serviceSnapshot.durationMinutes} minutes`,
            },
          },
        }],
        metadata: {
          transactionId: String(attempt._id),
          appointmentId: String(appointment._id),
          customerId,
        },
        payment_intent_data: {
          metadata: {
            transactionId: String(attempt._id),
            appointmentId: String(appointment._id),
            customerId,
          },
        },
        success_url: `${env.CLIENT_ORIGIN}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.CLIENT_ORIGIN}/payment/cancel?appointment_id=${encodeURIComponent(String(appointment._id))}`,
      },
      { idempotencyKey: `salonbook-checkout-${attempt._id}` },
    );
    if (!checkoutSession.url) throw new Error("Stripe did not return a hosted Checkout URL.");

    const stored = await Transaction.findOneAndUpdate(
      { _id: attempt._id, status: "pending", $or: [{ providerSessionId: { $exists: false } }, { providerSessionId: checkoutSession.id }] },
      { $set: { providerSessionId: checkoutSession.id } },
      { new: true, runValidators: true },
    ).exec();
    if (!stored) {
      const current = await Transaction.findById(attempt._id).lean().exec();
      if (current?.providerSessionId === checkoutSession.id && ["pending", "paid", "refunded"].includes(current.status)) {
        return current.status === "pending" ? { url: checkoutSession.url } : { processing: true, sessionId: checkoutSession.id };
      }
      throw httpError(409, "This payment attempt changed while Checkout was opening. Refresh your appointments.");
    }
    return { url: checkoutSession.url };
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error) throw error;
    // Keep the same pending attempt so a retry uses the same Stripe idempotency key.
    throw httpError(502, "Stripe could not create Checkout. Please try again shortly.");
  }
}

async function reconcileStripeTransaction(transaction: TransactionDocument, knownSession?: Stripe.Checkout.Session) {
  if (!["pending", "failed"].includes(transaction.status) || !transaction.providerSessionId) return false;
  try {
    const session = knownSession ?? await getStripe().checkout.sessions.retrieve(transaction.providerSessionId);
    assertSessionMatchesTransaction(session, transaction);
    if (session.status !== "complete" || session.payment_status !== "paid") return false;
    await markCheckoutPaid(transaction._id, session, "reconcile:" + session.id);
    return true;
  } catch (error) {
    const errorName = error instanceof Error ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80) : "UnknownError";
    console.error("[payments:reconcile] Could not verify a pending Stripe payment", errorName || "Error");
    return false;
  }
}

async function reconcileStripeTransactions(records: TransactionDocument[]) {
  const candidates = records
    .filter((record) => ["pending", "failed"].includes(record.status) && Boolean(record.providerSessionId))
    .slice(0, 10);
  if (!candidates.length) return false;
  const results = await Promise.all(candidates.map((record) => reconcileStripeTransaction(record)));
  return results.some(Boolean);
}

export async function reconcileCustomerAppointmentsPayments(customerId: string, appointmentIds: string[]) {
  const ids = appointmentIds.filter((id) => Types.ObjectId.isValid(id)).slice(0, 10).map((id) => new Types.ObjectId(id));
  if (!ids.length) return false;
  const records = await Transaction.find({
    customerId,
    appointmentId: { $in: ids },
    status: { $in: ["pending", "failed"] },
    providerSessionId: { $type: "string" },
  }).limit(10).lean().exec();
  return reconcileStripeTransactions(records as unknown as TransactionDocument[]);
}

export async function listMyTransactions(customerId: string, page: number, limit: number) {
  const filter = { customerId };
  let [records, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    Transaction.countDocuments(filter).exec(),
  ]);
  const reconciled = await reconcileStripeTransactions(records as unknown as TransactionDocument[]);
  if (reconciled) {
    records = await Transaction.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean().exec();
  }
  return {
    transactions: records.map((record) => safeTransaction(record as unknown as TransactionDocument)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getMyTransaction(customerId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const record = await Transaction.findOne({ _id: id, customerId }).lean().exec();
  if (!record) return null;
  await reconcileStripeTransaction(record as unknown as TransactionDocument);
  const latest = await Transaction.findOne({ _id: id, customerId }).lean().exec();
  return latest ? safeTransaction(latest as unknown as TransactionDocument) : null;
}

export async function getMyPaymentVerification(customerId: string, sessionId: string) {
  const transaction = await Transaction.findOne({ providerSessionId: sessionId, customerId }).lean().exec();
  if (!transaction) return null;
  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try { session = await stripe.checkout.sessions.retrieve(sessionId); }
  catch { throw httpError(502, "Stripe could not verify this Checkout session. Try again shortly."); }
  assertSessionMatchesTransaction(session, transaction as unknown as TransactionDocument);
  await reconcileStripeTransaction(transaction as unknown as TransactionDocument, session);
  const latest = await Transaction.findOne({ providerSessionId: sessionId, customerId }).lean().exec();
  if (!latest) return null;
  return {
    transaction: safeTransaction(latest as unknown as TransactionDocument),
    paymentVerified: latest.status === "paid" || latest.status === "refunded",
    stripeCheckoutStatus: session.status,
    stripePaymentStatus: session.payment_status,
  };
}

function adminTransactionPipeline(query: AdminTransactionsQuery): PipelineStage[] {
  const match: Record<string, unknown> = {};
  if (query.status !== "all") match.status = query.status;
  const createdAt = dateRange(query);
  if (createdAt) match.createdAt = createdAt;

  const pipeline: PipelineStage[] = [
    { $match: match },
    { $lookup: { from: User.collection.name, localField: "customerId", foreignField: "authUserId", as: "customerProfile" } },
    { $unwind: { path: "$customerProfile", preserveNullAndEmptyArrays: true } },
  ];
  if (query.search) {
    const search = { $regex: escapedRegex(query.search), $options: "i" };
    pipeline.push(
      { $addFields: { transactionIdText: { $toString: "$_id" }, appointmentIdText: { $toString: "$appointmentId" } } },
      { $match: { $or: [
        { transactionIdText: search },
        { appointmentIdText: search },
        { serviceName: search },
        { "customerProfile.name": search },
        { "customerProfile.email": search },
      ] } },
    );
  }
  const direction = query.sort === "oldest" ? 1 : -1;
  pipeline.push({
    $facet: {
      records: [
        { $sort: { createdAt: direction, _id: direction } },
        { $skip: (query.page - 1) * query.limit },
        { $limit: query.limit },
        { $project: {
          _id: { $toString: "$_id" },
          appointmentId: { $toString: "$appointmentId" },
          serviceId: { $cond: [{ $ifNull: ["$serviceId", false] }, { $toString: "$serviceId" }, null] },
          serviceName: 1,
          amount: 1,
          currency: 1,
          status: 1,
          paymentMethod: 1,
          paidAt: 1,
          createdAt: 1,
          customer: {
            name: { $ifNull: ["$customerProfile.name", "Customer account unavailable"] },
            email: { $ifNull: ["$customerProfile.email", ""] },
          },
        } },
      ],
      total: [{ $count: "count" }],
    },
  });
  return pipeline;
}

export async function listAdminTransactions(query: AdminTransactionsQuery) {
  const [result] = await Transaction.aggregate<{
    records: Array<Record<string, unknown>>;
    total: Array<{ count: number }>;
  }>(adminTransactionPipeline(query)).exec();
  const total = result?.total[0]?.count ?? 0;
  return { transactions: result?.records ?? [], page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
}

export async function getAdminTransactionStats() {
  const successfulFilter = { status: { $in: ["paid", "refunded"] } };
  const [totalTransactions, successfulPayments, revenueRows, payingCustomers] = await Promise.all([
    Transaction.countDocuments({}).exec(),
    Transaction.countDocuments(successfulFilter).exec(),
    Transaction.aggregate<{ totalRevenue: number }>([
      { $match: successfulFilter },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
    ]).exec(),
    Transaction.distinct("customerId", successfulFilter).exec(),
  ]);
  return {
    totalTransactions,
    successfulPayments,
    totalRevenue: revenueRows[0]?.totalRevenue ?? 0,
    uniquePayingCustomers: payingCustomers.length,
    currency: CHECKOUT_CURRENCY,
    revenueBasis: "gross-collected-before-refunds" as const,
  };
}

export async function getAdminTransaction(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const [transaction] = await Transaction.aggregate<Record<string, unknown>>([
    { $match: { _id: new Types.ObjectId(id) } },
    { $lookup: { from: User.collection.name, localField: "customerId", foreignField: "authUserId", as: "customerProfile" } },
    { $unwind: { path: "$customerProfile", preserveNullAndEmptyArrays: true } },
    { $project: {
      _id: { $toString: "$_id" },
      appointmentId: { $toString: "$appointmentId" },
      serviceId: { $cond: [{ $ifNull: ["$serviceId", false] }, { $toString: "$serviceId" }, null] },
      serviceName: 1,
      amount: 1,
      currency: 1,
      status: 1,
      paymentMethod: 1,
      paidAt: 1,
      createdAt: 1,
      updatedAt: 1,
      customer: {
        name: { $ifNull: ["$customerProfile.name", "Customer account unavailable"] },
        email: { $ifNull: ["$customerProfile.email", ""] },
      },
    } },
    { $limit: 1 },
  ]).exec();
  return transaction ?? null;
}

export async function processStripeEvent(event: Stripe.Event) {
  if (event.type === "charge.refunded") {
    await processRefundEvent(event);
    return;
  }
  if (event.type !== "checkout.session.completed"
    && event.type !== "checkout.session.async_payment_succeeded"
    && event.type !== "checkout.session.async_payment_failed"
    && event.type !== "checkout.session.expired") return;

  const eventSession = event.data.object as Stripe.Checkout.Session;
  const transactionId = eventSession.metadata?.transactionId;
  if (!transactionId || !Types.ObjectId.isValid(transactionId)) return;
  const transaction = await Transaction.findById(transactionId).lean().exec();
  if (!transaction) throw new Error("Payment transaction referenced by Stripe was not found.");
  assertSessionMatchesTransaction(eventSession, transaction as unknown as TransactionDocument);

  if (isFailedCheckoutEvent(event.type)) {
    await markCheckoutFailed(transaction._id, eventSession.id, event.id);
    return;
  }
  if (!isSuccessfulCheckoutEvent(event.type, eventSession.payment_status)) {
    await recordCheckoutEvent(transaction._id, eventSession.id, event.id);
    return;
  }

  let verifiedSession: Stripe.Checkout.Session;
  try { verifiedSession = await getStripe().checkout.sessions.retrieve(eventSession.id); }
  catch { throw new Error("Stripe could not retrieve the completed Checkout session."); }
  assertSessionMatchesTransaction(verifiedSession, transaction as unknown as TransactionDocument);
  if (!isSuccessfulCheckoutEvent(event.type, verifiedSession.payment_status) || verifiedSession.status !== "complete") {
    await recordCheckoutEvent(transaction._id, eventSession.id, event.id);
    return;
  }
  await markCheckoutPaid(transaction._id, verifiedSession, event.id);
}

async function markCheckoutPaid(transactionId: Types.ObjectId, session: Stripe.Checkout.Session, eventId: string) {
  const transaction = await Transaction.findById(transactionId).lean().exec();
  if (!transaction) throw new Error("Payment transaction disappeared while processing the webhook.");
  const appointment = await Appointment.findOne({ _id: transaction.appointmentId, customerId: transaction.customerId }).lean().exec();
  if (!appointment) throw new Error("The appointment does not match the stored payment owner.");
  if (transaction.providerSessionId && transaction.providerSessionId !== session.id) throw new Error("The Stripe session does not match the stored payment attempt.");
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const paymentMethod = session.payment_method_types?.[0];
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const current = await Transaction.findById(transactionId).session(dbSession).lean().exec();
      if (!current) throw new Error("Payment transaction disappeared while processing the webhook.");
      if (hasProcessedEvent(current.stripeEventIds, eventId)) return;
      if (current.providerSessionId && current.providerSessionId !== session.id) throw new Error("The Stripe session does not match the stored payment attempt.");

      const conflictingSuccess = await Transaction.findOne({
        successfulAppointmentId: current.appointmentId,
        _id: { $ne: current._id },
      }).session(dbSession).lean().exec();
      if (conflictingSuccess) {
        // A previous verified payment already owns this appointment. Never create a second successful record.
        await Transaction.updateOne({ _id: current._id }, { $addToSet: { stripeEventIds: eventId } }, { session: dbSession }).exec();
        return;
      }

      const updatedTransaction = await Transaction.findOneAndUpdate(
        { _id: current._id, stripeEventIds: { $ne: eventId } },
        {
          $set: {
            providerSessionId: session.id,
            successfulAppointmentId: current.appointmentId,
            status: current.status === "refunded" ? "refunded" : "paid",
            ...(paymentIntentId ? { providerPaymentIntentId: paymentIntentId } : {}),
            ...(paymentMethod ? { paymentMethod } : {}),
            paidAt: current.paidAt ?? new Date(),
          },
          $addToSet: { stripeEventIds: eventId },
        },
        { new: true, runValidators: true, session: dbSession },
      ).exec();
      if (!updatedTransaction) return;

      const appointmentUpdate = await Appointment.findOneAndUpdate(
        { _id: current.appointmentId, customerId: current.customerId, paymentStatus: { $ne: "paid" } },
        { $set: { paymentStatus: "paid" } },
        { new: true, runValidators: true, session: dbSession },
      ).exec();
      if (!appointmentUpdate) {
        const currentAppointment = await Appointment.findOne({ _id: current.appointmentId, customerId: current.customerId })
          .select("paymentStatus").session(dbSession).lean().exec();
        if (currentAppointment?.paymentStatus !== "paid") throw new Error("The verified payment could not be attached to its appointment.");
      }
    });
  } finally { await dbSession.endSession(); }
}

async function recordCheckoutEvent(transactionId: Types.ObjectId, sessionId: string, eventId: string) {
  await Transaction.updateOne(
    { _id: transactionId, stripeEventIds: { $ne: eventId }, $or: [{ providerSessionId: sessionId }, { providerSessionId: { $exists: false } }] },
    { $set: { providerSessionId: sessionId }, $addToSet: { stripeEventIds: eventId } },
  ).exec();
}

async function markCheckoutFailed(transactionId: Types.ObjectId, sessionId: string, eventId: string) {
  await Transaction.updateOne(
    { _id: transactionId, stripeEventIds: { $ne: eventId }, $or: [{ providerSessionId: sessionId }, { providerSessionId: { $exists: false } }] },
    { $set: { providerSessionId: sessionId }, $addToSet: { stripeEventIds: eventId } },
  ).exec();
  await Transaction.updateOne(
    { _id: transactionId, status: "pending", stripeEventIds: eventId },
    { $set: { status: "failed" } },
  ).exec();
}

async function processRefundEvent(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;
  // Retrieve the PaymentIntent rather than trusting a client return or charge metadata.
  // Stripe may deliver charge.refunded before checkout.session.completed.
  const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  const transactionId = paymentIntent.metadata?.transactionId;
  if (!transactionId || !Types.ObjectId.isValid(transactionId)) return;
  const transaction = await Transaction.findById(transactionId).lean().exec();
  if (!transaction) throw new Error("The refunded Stripe payment references an unknown SalonBook transaction.");
  assertPaymentIntentMatchesTransaction(paymentIntent, transaction as unknown as TransactionDocument);
  if (transaction.providerPaymentIntentId && transaction.providerPaymentIntentId !== paymentIntentId) {
    throw new Error("The Stripe refund does not match its stored payment attempt.");
  }
  if (charge.amount !== toStripeMinorUnits(transaction.amount, transaction.currency)
    || charge.currency?.toLowerCase() !== transaction.currency.toLowerCase()) {
    throw new Error("The refunded Stripe charge amount does not match its stored transaction.");
  }
  const appointment = await Appointment.findOne({ _id: transaction.appointmentId, customerId: transaction.customerId }).lean().exec();
  if (!appointment) throw new Error("The refunded payment appointment does not match its stored owner.");

  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const current = await Transaction.findById(transaction._id).session(dbSession).lean().exec();
      if (!current || hasProcessedEvent(current.stripeEventIds, event.id)) return;
      if (current.providerPaymentIntentId && current.providerPaymentIntentId !== paymentIntentId) {
        throw new Error("The Stripe refund does not match its stored payment attempt.");
      }
      const conflictingSuccess = await Transaction.findOne({ successfulAppointmentId: current.appointmentId, _id: { $ne: current._id } })
        .session(dbSession).lean().exec();
      if (conflictingSuccess) throw new Error("Another verified payment already exists for this appointment.");
      await Transaction.findOneAndUpdate(
        { _id: current._id, stripeEventIds: { $ne: event.id } },
        {
          $set: {
            providerPaymentIntentId: paymentIntentId,
            successfulAppointmentId: current.appointmentId,
            status: charge.refunded ? "refunded" : current.status === "refunded" ? "refunded" : "paid",
            paidAt: current.paidAt ?? new Date(),
          },
          $addToSet: { stripeEventIds: event.id },
        },
        { new: true, runValidators: true, session: dbSession },
      ).exec();
      await Appointment.updateOne({ _id: current.appointmentId, customerId: current.customerId }, { $set: { paymentStatus: "paid" } }, { session: dbSession }).exec();
    });
  } finally { await dbSession.endSession(); }
}

export async function dashboardSummary(customerId: string, isAdmin: boolean) {
  const appointmentFilter = isAdmin ? {} : { customerId };
  const transactionFilter = isAdmin ? {} : { customerId };
  const [appointments, transactions, totalCustomers, totalServices, activeServices] = await Promise.all([
    Appointment.aggregate([{ $match: appointmentFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]).exec(),
    Transaction.aggregate([{ $match: transactionFilter }, { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$amount" } } }]).exec(),
    isAdmin ? User.countDocuments({ role: "customer" }).exec() : Promise.resolve(0),
    isAdmin ? ServiceCount() : Promise.resolve(0),
    isAdmin ? ServiceCount(true) : Promise.resolve(0),
  ]);
  return {
    appointments: Object.fromEntries(appointments.map((row) => [row._id, row.count])),
    transactions: Object.fromEntries(transactions.map((row) => [row._id, { count: row.count, revenue: row.revenue }])),
    ...(isAdmin ? { customers: totalCustomers, services: { total: totalServices, active: activeServices } } : {}),
  };
}

async function ServiceCount(activeOnly = false) {
  const { Service } = await import("../services/service.model");
  return Service.countDocuments(activeOnly ? { isActive: true } : {}).exec();
}
