import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth";
import { authenticate, AuthenticatedRequest, requireRole } from "./middleware/authenticate";
import { serviceRouter } from "./modules/services/service.routes";
import { appointmentRouter } from "./modules/appointments/appointment.routes";
import { userRouter } from "./modules/users/user.routes";
import { transactionRouter } from "./modules/transactions/transaction.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { webhook } from "./modules/transactions/transaction.controller";
import { uploadRouter } from "./modules/uploads/upload.routes";

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
  // Better Auth must run before express.json() so its request body remains readable.
  app.all("/api/auth/*", toNodeHandler(auth));
  app.post("/api/transactions/webhook", express.raw({ type: "application/json" }), webhook);
  app.use("/api/uploads", express.json({ limit: "8mb" }));
  app.use(express.json());
  app.get("/api/health", (_req, res) => res.json({ data: { status: "ok", service: "salonbook-api" }, error: null }));
  app.get("/api/admin/check", authenticate, requireRole("admin"), (_req, res) => {
    res.json({ data: { access: "admin" }, error: null });
  });
  app.use("/api/services", serviceRouter);
  app.use("/api/appointments", appointmentRouter);
  app.use("/api/users", userRouter);
  app.use("/api/transactions", transactionRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/uploads", uploadRouter);
  app.use((_req, res) => res.status(404).json({ data: null, error: { message: "Route not found" } }));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    const typedError = err as { status?: number; code?: number };
    if (typedError.code === 11000) return res.status(409).json({ data: null, error: { message: "A record with that unique value already exists" } });
    return res.status(typedError.status ?? 500).json({ data: null, error: { message: typedError.status ? (err as Error).message : "Internal server error" } });
  });
  return app;
}
