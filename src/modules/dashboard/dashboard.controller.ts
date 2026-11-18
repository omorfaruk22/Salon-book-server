import type { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { dashboardSummary } from "../transactions/transaction.service";

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as AuthenticatedRequest).authUser!;
    const data = await dashboardSummary(user.id, user.role === "admin");
    return res.json({ data, error: null });
  } catch (error) { next(error); }
}
