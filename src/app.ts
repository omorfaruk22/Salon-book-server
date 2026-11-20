import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env";
import { auth } from "./config/auth";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { requestLogger } from "./middleware/request-logger";
import { authenticate, requireRole } from "./middleware/authenticate";
import type { AuthenticatedRequest } from "./middleware/authenticate";
import { healthRouter } from "./modules/health/health.routes";
import { serviceRouter } from "./modules/services/service.routes";
import { appointmentRouter } from "./modules/appointments/appointment.routes";
import { userRouter } from "./modules/users/user.routes";
import { transactionRouter } from "./modules/transactions/transaction.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { webhook } from "./modules/transactions/transaction.controller";
import { uploadRouter } from "./modules/uploads/upload.routes";
import { adminDashboardRouter } from "./modules/admin-dashboard/admin-dashboard.routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  const allowedOrigins = new Set([env.CLIENT_ORIGIN]);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(Object.assign(new Error("Origin is not allowed by CORS"), { status: 403 }));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Stripe-Signature"],
    maxAge: 600,
  }));
  app.use(requestLogger);
  app.use(cookieParser());
  // Better Auth must run before express.json() so its request body remains readable.
  app.all("/api/auth/*", toNodeHandler(auth));
  app.post("/api/transactions/webhook", express.raw({ type: "application/json", limit: "1mb" }), webhook);
  app.use("/api/uploads", express.json({ limit: "8mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use("/api/health", healthRouter);
  app.get("/api/admin/check", authenticate, requireRole("admin"), (_req, res) => {
    res.json({ data: { access: "admin" }, error: null });
  });
  app.use("/api/services", serviceRouter);
  app.use("/api/appointments", appointmentRouter);
  app.use("/api/users", userRouter);
  app.use("/api/transactions", transactionRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/admin/dashboard", adminDashboardRouter);
  app.use("/api/uploads", uploadRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
