import { Router } from "express";
import { authenticate, requireAdmin, requireCustomer } from "../../middleware/authenticate";
import { all, cancelMine, changeStatus, confirm, create, details, mine } from "./appointment.controller";

export const appointmentRouter = Router();
appointmentRouter.use(authenticate);
appointmentRouter.post("/", requireCustomer, create);
appointmentRouter.get("/", requireCustomer, mine);
appointmentRouter.get("/admin", requireAdmin, all);
appointmentRouter.patch("/:id/cancel", requireCustomer, cancelMine);
appointmentRouter.patch("/:id/confirm", requireAdmin, confirm);
appointmentRouter.patch("/:id/status", requireAdmin, changeStatus);
appointmentRouter.get("/:id", details);
