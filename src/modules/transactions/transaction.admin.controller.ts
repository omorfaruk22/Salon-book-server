import type { NextFunction, Request, Response } from "express";
import { adminTransactionsQuerySchema } from "./transaction.validation";
import { getAdminTransaction, getAdminTransactionStats, listAdminTransactions } from "./transaction.service";

export async function listAdminTransactionsController(req: Request, res: Response, next: NextFunction) {
  const parsed = adminTransactionsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: "Invalid transaction filters" } });
  try { return res.json({ data: await listAdminTransactions(parsed.data), error: null }); }
  catch (error) { next(error); }
}

export async function adminTransactionStatsController(_req: Request, res: Response, next: NextFunction) {
  try { return res.json({ data: await getAdminTransactionStats(), error: null }); }
  catch (error) { next(error); }
}

export async function adminTransactionDetailsController(req: Request, res: Response, next: NextFunction) {
  try {
    const transaction = await getAdminTransaction(String(req.params.id));
    if (!transaction) return res.status(404).json({ data: null, error: { message: "Transaction not found" } });
    return res.json({ data: transaction, error: null });
  } catch (error) { next(error); }
}
