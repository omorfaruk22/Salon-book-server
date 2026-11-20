import { Router } from "express";
import { authenticate, requireAdmin } from "../../middleware/authenticate";
import { appointmentAnalytics, recentAppointments, recentTransactions, stats } from "./admin-dashboard.controller";

export const adminDashboardRouter = Router();
adminDashboardRouter.use(authenticate, requireAdmin);
adminDashboardRouter.get("/stats", stats);
adminDashboardRouter.get("/recent-appointments", recentAppointments);
adminDashboardRouter.get("/recent-transactions", recentTransactions);
adminDashboardRouter.get("/appointment-analytics", appointmentAnalytics);
