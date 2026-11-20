import type { NextFunction, Request, Response } from "express";
import { getAdminAppointmentAnalytics, getAdminDashboardStats, getRecentAdminAppointments, getRecentSuccessfulAdminTransactions } from "./admin-dashboard.service";
import { appointmentAnalyticsQuerySchema, recentLimitQuerySchema } from "./admin-dashboard.validation";

function invalidQuery(res: Response) {
  return res.status(400).json({ data: null, error: { message: "Invalid dashboard query. Use a limit from 1 to 12 or an analytics range from 7 to 90 days." } });
}

export async function stats(_req: Request, res: Response, next: NextFunction) {
  try { return res.json({ data: await getAdminDashboardStats(), error: null }); }
  catch (error) { return next(error); }
}

export async function recentAppointments(req: Request, res: Response, next: NextFunction) {
  const parsed = recentLimitQuerySchema.safeParse(req.query);
  if (!parsed.success) return invalidQuery(res);
  try { return res.json({ data: await getRecentAdminAppointments(parsed.data.limit), error: null }); }
  catch (error) { return next(error); }
}

export async function recentTransactions(req: Request, res: Response, next: NextFunction) {
  const parsed = recentLimitQuerySchema.safeParse(req.query);
  if (!parsed.success) return invalidQuery(res);
  try { return res.json({ data: await getRecentSuccessfulAdminTransactions(parsed.data.limit), error: null }); }
  catch (error) { return next(error); }
}

export async function appointmentAnalytics(req: Request, res: Response, next: NextFunction) {
  const parsed = appointmentAnalyticsQuerySchema.safeParse(req.query);
  if (!parsed.success) return invalidQuery(res);
  try { return res.json({ data: await getAdminAppointmentAnalytics(parsed.data.days), error: null }); }
  catch (error) { return next(error); }
}
