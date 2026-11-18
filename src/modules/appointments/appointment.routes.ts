import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/authenticate";
import { all, cancelMine, changeStatus, confirm, create, details, mine } from "./appointment.controller";

export const appointmentRouter = Router();
appointmentRouter.use(authenticate);
appointmentRouter.post("/", requireRole("customer", "admin"), create);
appointmentRouter.get("/", requireRole("customer", "admin"), mine);
appointmentRouter.get("/admin", requireRole("admin"), all);
appointmentRouter.patch("/:id/cancel", requireRole("customer", "admin"), cancelMine);
appointmentRouter.patch("/:id/confirm", requireRole("admin"), confirm);
appointmentRouter.patch("/:id/status", requireRole("admin"), changeStatus);
appointmentRouter.get("/:id", details);
