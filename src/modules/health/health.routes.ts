import { Router } from "express";
import { env } from "../../config/env";
import { getDatabaseStatus } from "../../config/database";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const databaseStatus = getDatabaseStatus();
  const healthy = databaseStatus === "connected";
  return res.status(healthy ? 200 : 503).json({
    data: {
      status: healthy ? "ok" : "degraded",
      service: "salonbook-api",
      serverStatus: "running",
      databaseStatus,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    error: healthy ? null : { message: "Database is not connected" },
  });
});
